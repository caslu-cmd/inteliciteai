import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Espelho dos acórdãos do TCU a partir da API de dados abertos do TCU (a busca por número
// do site do TCU bloqueia acesso automatizado). A API lista do mais novo para o mais
// antigo, 500 por página, e cobre cerca de 57 mil acórdãos (de agosto/2023 em diante).
// Cada execução: (1) atualiza os mais novos até achar uma página já conhecida;
// (2) avança o preenchimento do histórico a partir do cursor salvo em internal_config.

const API = "https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos";
const POR_PAGINA = 500;
const PAGINAS_HISTORICO = 12;       // ~6 mil acórdãos por execução (~2 min)
const CURSOR = "tcu_acordaos_cursor";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };

type Registro = {
  key: string; tipo?: string; numeroAcordao?: string; anoAcordao?: string; colegiado?: string; relator?: string;
  dataSessao?: string; situacao?: string; sumario?: string; urlAcordao?: string;
};

async function pagina(inicio: number): Promise<Registro[]> {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`${API}?inicio=${inicio}&quantidade=${POR_PAGINA}`, { signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
    } catch { /* tenta de novo */ }
    await new Promise((res) => setTimeout(res, 1500 * (t + 1)));
  }
  throw new Error(`TCU indisponível (inicio=${inicio})`);
}

const data = (s?: string) => {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const linha = (r: Registro) => ({
  key: r.key, tipo: r.tipo ?? null, numero: Number(r.numeroAcordao), ano: Number(r.anoAcordao),
  colegiado: r.colegiado ?? null, relator: r.relator ?? null, data_sessao: data(r.dataSessao),
  situacao: r.situacao ?? null, sumario: (r.sumario || "").slice(0, 600), url: r.urlAcordao ?? null,
  atualizado_em: new Date().toISOString(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
  if (!cfg?.value || req.headers.get("x-cron-secret") !== cfg.value) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });
  }

  const gravar = async (regs: Registro[]) => {
    const rows = regs.filter((r) => r.key && Number(r.numeroAcordao) && Number(r.anoAcordao)).map(linha);
    if (rows.length) {
      const { error } = await supabase.from("tcu_acordaos").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return rows.length;
  };

  try {
    // (1) novos: do topo até uma página em que todos já estão no espelho
    let novos = 0;
    for (let p = 0; p < 6; p++) {
      const regs = await pagina(p * POR_PAGINA);
      if (!regs.length) break;
      const { count } = await supabase.from("tcu_acordaos").select("key", { count: "exact", head: true }).in("key", regs.map((r) => r.key));
      novos += await gravar(regs);
      if ((count ?? 0) >= regs.length) break;
    }

    // (2) histórico: continua de onde parou até a API acabar
    const { data: cur } = await supabase.from("internal_config").select("value").eq("key", CURSOR).maybeSingle();
    let inicio = cur?.value ? Number(JSON.parse(cur.value).inicio) : 0;
    let concluido = cur?.value ? !!JSON.parse(cur.value).concluido : false;
    let historico = 0;
    for (let p = 0; p < PAGINAS_HISTORICO && !concluido; p++) {
      const regs = await pagina(inicio);
      if (!regs.length) { concluido = true; break; }
      historico += await gravar(regs);
      inicio += regs.length;
    }
    await supabase.from("internal_config").upsert({ key: CURSOR, value: JSON.stringify({ inicio, concluido }) }, { onConflict: "key" });
    const { count: total } = await supabase.from("tcu_acordaos").select("key", { count: "exact", head: true });
    return new Response(JSON.stringify({ ok: true, novos, historico, cursor: inicio, concluido, total }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502, headers: cors });
  }
});
