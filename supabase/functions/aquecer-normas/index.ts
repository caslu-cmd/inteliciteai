import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { carregarIndice, normasParaAquecer, prepararComPlanalto } from "../_shared/verifica-citacoes.ts";
import { buscarNoPlanalto, nomeNorma } from "../_shared/planalto.ts";

// Pré-carga noturna da base jurídica: traz do Planalto as normas que as íntegras oficiais
// já indexadas citam (Lei das S.A., LRF, LINDB, ...) e a Constituição, poucas por execução.
// Com isso a conferência de citações quase nunca depende do Planalto estar no ar na hora.

const POR_EXECUCAO = 4;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
  if (!cfg?.value || req.headers.get("x-cron-secret") !== cfg.value) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });
  }
  try {
    const idx = await carregarIndice(supabase);
    // Constituição: a mesma rotina da conferência grava na base quando falta
    if (!idx.has("cf")) await prepararComPlanalto("Constituição Federal", idx, supabase);

    // Endereço oficial das normas importadas que ficaram sem link (o link de verificação sai dele)
    const { data: semUrl } = await supabase.from("legal_knowledge").select("id, reference")
      .is("url", null).like("title", "%íntegra do Planalto%").limit(3);
    for (const r of semUrl || []) {
      const m = r.reference.match(/([\d.]+)\/(\d{4})/);
      if (!m) continue;
      const tipo = /^Lei Complementar/.test(r.reference) ? "lc" : /^Decreto-Lei/.test(r.reference) ? "dl" : /^Decreto/.test(r.reference) ? "dec" : "lei";
      const achado = await buscarNoPlanalto(tipo, Number(m[1].replace(/\./g, "")), [Number(m[2])]);
      if (achado.situacao === "encontrada") await supabase.from("legal_knowledge").update({ url: achado.url }).eq("id", r.id);
    }

    // Fila com cursor: a norma que o Planalto não achar não trava as demais.
    const fila = normasParaAquecer(idx);
    const { data: cur } = await supabase.from("internal_config").select("value").eq("key", "aquecer_normas_cursor").maybeSingle();
    let de = Number(cur?.value || 0);
    if (de >= fila.length) de = 0;
    const lote = fila.slice(de, de + POR_EXECUCAO);
    // a mesma rotina da conferência: busca no Planalto, indexa em memória e grava na base
    await prepararComPlanalto(lote.map((n) => nomeNorma(n.tipo, n.num, n.ano)).join("; "), idx, supabase, POR_EXECUCAO);
    const feitas = lote.map((n) => `${nomeNorma(n.tipo, n.num, n.ano)}: ${idx.has(`${n.tipo}|${n.num}`) ? "importada" : "não encontrada agora"}`);
    const importadas = lote.filter((n) => idx.has(`${n.tipo}|${n.num}`)).length;
    await supabase.from("internal_config").upsert({ key: "aquecer_normas_cursor", value: String(de + lote.length - importadas) }, { onConflict: "key" });
    return new Response(JSON.stringify({ ok: true, feitas, naFila: fila.length - importadas, cf: idx.has("cf") }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502, headers: cors });
  }
});
