import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Alertas diários de editais compatíveis.
// Fonte: consulta oficial do PNCP (editais PUBLICADOS nos últimos dias, ainda
// com propostas abertas), por UF e modalidade. Cruzamento: palavras-chave do
// usuário ou, sem elas, o Match IA sobre o perfil da empresa (CNAEs + texto).
// Chamado pelo cron (8h e retentativa às 11h BRT) com x-cron-secret.
//
// Body opcional: { retry: true }   → só roda se o dia ainda não concluiu
//                { dry_run: true, user_id?: "..." } → não grava nada, devolve os matches

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PNCP_PUBLICACAO = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODALIDADES = ["6", "8"];        // Pregão Eletrônico + Dispensa
const JANELA_DIAS = 3;                 // cobre fim de semana; a deduplicação evita repetir
const PAGINAS_MAX = 4;                 // 4 × 50 = até 200 editais por UF/modalidade
const MAX_NOVOS_POR_USUARIO = 5;
const MAX_CANDIDATOS_IA = 60;
const NOTA_MINIMA_IA = 70;
const TEMPO_MAX_MS = 110_000;          // margem para o limite da edge function

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const hoje = () => new Date().toISOString().slice(0, 10);

async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let ultimo: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Intelicite/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (r.status >= 500) ultimo = new Error(`PNCP ${r.status}`);
      else return r;
    } catch (e) { ultimo = e; }
    await new Promise((s) => setTimeout(s, 700 * (i + 1)));
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

// deno-lint-ignore no-explicit-any
type Edital = any;

// Editais publicados na janela, ainda abertos, para uma UF (ou Brasil) e modalidade.
async function publicados(uf: string | null, modalidade: string): Promise<Edital[]> {
  const agora = new Date();
  const ini = new Date(agora.getTime() - JANELA_DIAS * 86400000);
  const itens: Edital[] = [];
  for (let pagina = 1; pagina <= PAGINAS_MAX; pagina++) {
    const q = new URLSearchParams({
      dataInicial: yyyymmdd(ini), dataFinal: yyyymmdd(agora),
      codigoModalidadeContratacao: modalidade, pagina: String(pagina), tamanhoPagina: "50",
    });
    if (uf) q.set("uf", uf.toUpperCase());
    const res = await fetchRetry(`${PNCP_PUBLICACAO}?${q}`);
    if (res.status === 204) break;                       // nada publicado na janela
    if (!res.ok) throw new Error(`PNCP publicacao ${res.status}`);
    const d = await res.json();
    itens.push(...(d.data || []));
    if (pagina >= Number(d.totalPaginas || 1)) break;
  }
  const agoraIso = agora.toISOString();
  return itens.filter((c) => !c.dataEncerramentoProposta || c.dataEncerramentoProposta > agoraIso);
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["id", "match", "motivo"],
        properties: {
          id: { type: "string" }, match: { type: "integer" },
          motivo: { type: "string", description: "máx. 12 palavras" },
        },
      },
    },
  },
};

const SYSTEM =
  `Você avalia o "match" (aderência comercial) entre o que uma empresa fornece e licitações públicas brasileiras. ` +
  `Para CADA licitação, devolva o MESMO id, "match" de 0 a 100 e "motivo" curto em português. ` +
  `Se o perfil trouxer códigos CNAE, interprete-os pela classificação do IBGE. Não omita nenhuma licitação.`;

// Match IA: nota 0–100 por edital contra o perfil da empresa (mesma IA do Radar).
async function matchIA(apiKey: string, perfil: string, candidatos: Edital[]): Promise<Map<string, { match: number; motivo: string }>> {
  const lista = candidatos.map((c) => ({
    id: String(c.numeroControlePNCP), objeto: String(c.objetoCompra || "").slice(0, 400),
    orgao: c.orgaoEntidade?.razaoSocial || "",
  }));
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-opus-4-8", max_tokens: 8000, system: SYSTEM,
      messages: [{ role: "user", content: `PERFIL DA EMPRESA:\n"${perfil}"\n\nLICITAÇÕES (${lista.length}):\n${JSON.stringify(lista)}` }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`IA ${res.status}`);
  const data = await res.json();
  if (data.stop_reason !== "end_turn") throw new Error(`IA stop_reason=${data.stop_reason}`);
  const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const parsed = JSON.parse(text) as { scores: { id: string; match: number; motivo: string }[] };
  const mapa = new Map<string, { match: number; motivo: string }>();
  for (const s of parsed.scores || []) mapa.set(String(s.id), { match: Number(s.match) || 0, motivo: String(s.motivo || "").slice(0, 120) });
  return mapa;
}

const fmtData = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const inicio = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Autenticação: só o cron interno (segredo em internal_config).
  const secret = req.headers.get("x-cron-secret") || "";
  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
  if (!cfg?.value || secret !== cfg.value) return json({ error: "Não autorizado" }, 401);

  let body: { retry?: boolean; dry_run?: boolean; user_id?: string; uf?: string } = {};
  try { body = await req.json(); } catch { /* sem body */ }
  const dryRun = !!body.dry_run;

  // Retentativa: só roda se o dia ainda não concluiu com sucesso.
  const { data: ultimo } = await supabase.from("internal_config").select("value").eq("key", "alertas_ultimo_ok").maybeSingle();
  if (body.retry && ultimo?.value === hoje()) return json({ ok: true, skipped: true, motivo: "já concluído hoje" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";

  // dry_run + user_id testa um perfil específico mesmo sem alerta ativo (e com
  // uf opcional), sem gravar nada.
  let q = supabase.from("profiles")
    .select("id, alerta_keywords, alerta_uf, empresa_perfil")
    .limit(300);
  q = dryRun && body.user_id ? q.eq("id", body.user_id) : q.eq("alerta_ativo", true);
  const { data: usersRaw } = await q;
  const users = (usersRaw ?? []).map((u) => (dryRun && body.uf ? { ...u, alerta_uf: body.uf } : u));

  const cacheEditais = new Map<string, Promise<Edital[]>>();
  const editaisPara = (uf: string | null) => {
    const chave = uf || "BR";
    if (!cacheEditais.has(chave)) {
      cacheEditais.set(chave, (async () => {
        const porModalidade = await Promise.allSettled(MODALIDADES.map((m) => publicados(uf, m)));
        const ok = porModalidade.filter((r): r is PromiseFulfilledResult<Edital[]> => r.status === "fulfilled");
        if (ok.length === 0) throw (porModalidade[0] as PromiseRejectedResult).reason;
        const vistos = new Set<string>();
        return ok.flatMap((r) => r.value).filter((c) => {
          const id = String(c.numeroControlePNCP || "");
          if (!id || vistos.has(id)) return false;
          vistos.add(id); return true;
        });
      })());
    }
    return cacheEditais.get(chave)!;
  };

  let usuarios = 0, notificados = 0, pncpOk = 0, pncpFalhas = 0, parcial = false;
  const resultado: Record<string, unknown>[] = [];

  for (const u of users) {
    if (Date.now() - inicio > TEMPO_MAX_MS) { parcial = true; break; }
    const termos = (u.alerta_keywords || "").split(/[,;\n]/).map((t: string) => semAcento(t.trim())).filter((t: string) => t.length >= 3);
    const perfil = (u.empresa_perfil || "").trim();
    if (termos.length === 0 && !perfil) continue;
    usuarios++;

    try {
      let candidatos: Edital[];
      try { candidatos = await editaisPara(u.alerta_uf || null); pncpOk++; }
      catch (e) { pncpFalhas++; console.error(`alertas: PNCP falhou para ${u.alerta_uf || "BR"}: ${String(e)}`); continue; }
      if (candidatos.length === 0) continue;

      // Já avisados não entram nem na IA (economia e sem repetição).
      const ids = candidatos.map((c) => String(c.numeroControlePNCP));
      const { data: enviados } = await supabase.from("alertas_enviados").select("edital_id").eq("user_id", u.id).in("edital_id", ids);
      const ja = new Set((enviados ?? []).map((e: { edital_id: string }) => e.edital_id));
      candidatos = candidatos.filter((c) => !ja.has(String(c.numeroControlePNCP)));

      let escolhidos: { c: Edital; motivo: string }[] = [];
      if (termos.length > 0) {
        escolhidos = candidatos
          .filter((c) => { const alvo = semAcento(`${c.objetoCompra || ""} ${c.orgaoEntidade?.razaoSocial || ""}`); return termos.some((t: string) => alvo.includes(t)); })
          .map((c) => ({ c, motivo: "" }));
      } else if (apiKey) {
        // Mais próximos do encerramento primeiro: são os que mais precisam de aviso.
        const lote = candidatos
          .sort((a, b) => String(a.dataEncerramentoProposta || "").localeCompare(String(b.dataEncerramentoProposta || "")))
          .slice(0, MAX_CANDIDATOS_IA);
        const notas = await matchIA(apiKey, perfil, lote);
        escolhidos = lote
          .map((c) => ({ c, nota: notas.get(String(c.numeroControlePNCP))?.match ?? 0, motivo: notas.get(String(c.numeroControlePNCP))?.motivo ?? "" }))
          .filter((x) => x.nota >= NOTA_MINIMA_IA)
          .sort((a, b) => b.nota - a.nota)
          .map((x) => ({ c: x.c, motivo: `Match ${x.nota}${x.motivo ? ` · ${x.motivo}` : ""}` }));
      }

      const novos = escolhidos.slice(0, MAX_NOVOS_POR_USUARIO);
      for (const { c, motivo } of novos) {
        const objeto = String(c.objetoCompra || "Novo edital").replace(/\s+/g, " ").slice(0, 150);
        const orgao = c.orgaoEntidade?.razaoSocial || "";
        const prazo = fmtData(c.dataEncerramentoProposta);
        const message = `${objeto}${orgao ? ` — ${orgao}` : ""}${prazo ? ` · Propostas até ${prazo}` : ""}${motivo ? ` · ${motivo}` : ""}`.slice(0, 300);
        if (dryRun) { resultado.push({ user: u.id, id: c.numeroControlePNCP, message }); continue; }
        await supabase.from("notifications").insert({
          user_id: u.id, title: "Novo edital compatível 🎯", message, type: "info", action_url: "/licitante/radar", read: false,
        });
        await supabase.from("alertas_enviados").insert({ user_id: u.id, edital_id: String(c.numeroControlePNCP) });
        notificados++;
      }
      if (dryRun) resultado.push({ user: u.id, uf: u.alerta_uf, candidatos: candidatos.length, modo: termos.length ? "palavras-chave" : "match-ia", escolhidos: escolhidos.length });
    } catch (e) {
      console.error(`alertas: usuário ${u.id} falhou: ${String(e)}`);
    }
  }

  // Sinal para o monitor do PNCP.
  if (pncpOk + pncpFalhas > 0) {
    await supabase.from("pncp_health").insert({ endpoint: "consulta", ok: pncpFalhas === 0, detail: `alertas: ok=${pncpOk} falhas=${pncpFalhas}`, origem: "alertas" }).then(() => {}, () => {});
  }

  // Dia concluído se não houve falha do PNCP (ou nada a fazer) e não parou por tempo.
  const concluido = !parcial && pncpFalhas === 0;
  if (concluido && !dryRun) {
    await supabase.from("internal_config").upsert({ key: "alertas_ultimo_ok", value: hoje() }, { onConflict: "key" });
  }

  console.log(`alertas: usuarios=${usuarios} notificados=${notificados} pncpOk=${pncpOk} pncpFalhas=${pncpFalhas} parcial=${parcial} dry=${dryRun}`);
  return json({ ok: true, usuarios, notificados, pncpOk, pncpFalhas, parcial, concluido, ...(dryRun ? { dry_run: true, resultado } : {}) });
});
