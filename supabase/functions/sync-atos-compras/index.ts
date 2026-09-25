import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { htmlParaTexto } from "../_shared/planalto.ts";

// Catálogo de atos infralegais de compras do Portal de Compras (gov.br/compras): INs,
// portarias, orientações normativas e resoluções, vigentes e revogadas. Cada execução:
// (1) uma vez por dia relista as seções (paginadas de 30 em 30) e marca a vigência;
// (2) importa a íntegra de alguns atos vigentes ainda sem texto na base (legal_knowledge +
// trechos com embeddings), para a conferência de artigo e para a busca por semelhança.

const BASE = "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao";
const SECOES = [
  { slug: "instrucoes-normativas", tipo: "IN", vigente: true },
  { slug: "instrucoes-normativas-revogadas", tipo: "IN", vigente: false },
  { slug: "portarias", tipo: "Portaria", vigente: true },
  { slug: "portarias-revogadas", tipo: "Portaria", vigente: false },
  { slug: "orientacoes-normativas", tipo: "ON", vigente: true },
  { slug: "orientacoes-normativas-revogadas", tipo: "ON", vigente: false },
  { slug: "resolucoes", tipo: "Resolução", vigente: true },
  { slug: "resolucoes-revogadas", tipo: "Resolução", vigente: false },
];
const IMPORTAR_POR_EXECUCAO = 5;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NOME_TIPO: Record<string, string> = { IN: "Instrução Normativa", Portaria: "Portaria", ON: "Orientação Normativa", "Resolução": "Resolução" };

async function baixar(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Intelicite/1.0" }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return await r.text();
}

// "instrucao-normativa-seges-me-no-73-de-30-de-setembro-de-2022" -> IN SEGES/ME 73/2022
// (tolera os erros de digitação do próprio portal: "normtaiva", sufixos "-1", "ss")
function lerSlug(slug: string, tipo: string) {
  const m = slug.match(/-n[o0]-([\d-]+?)-de-(?:\d{1,2}|1o)-de-([a-zç]+)-de-(\d{4})/);
  if (!m) return null;
  const numero = Number(m[1].replace(/-/g, ""));
  const orgaoBruto = slug.slice(0, m.index!).replace(/^(instrucao-normativa|instrucao-normtaiva|portaria|orientacao-normativa|resolucao)-?(conjunta-)?/, "");
  const orgao = orgaoBruto ? orgaoBruto.split("-").filter(Boolean).map((p) => p.toUpperCase()).join("/") : null;
  const ano = Number(m[3]);
  if (!numero || !MESES.includes(m[2])) return null;
  return { tipo, orgao, numero, ano, titulo: `${NOME_TIPO[tipo]}${orgao ? ` ${orgao}` : ""} nº ${numero.toLocaleString("pt-BR")}/${ano}` };
}

function fatiar(text: string, size = 800, overlap = 120): string[] {
  const out: string[] = [];
  let ini = 0;
  while (ini < text.length) {
    let fim = Math.min(ini + size, text.length);
    if (fim < text.length) {
      const corte = Math.max(text.lastIndexOf("\n", fim), text.lastIndexOf(". ", fim), text.lastIndexOf("Art. ", fim));
      if (corte > ini + size - 200) fim = corte + 1;
    }
    const c = text.slice(ini, fim).trim();
    if (c.length > 30) out.push(c);
    if (fim >= text.length) break;
    ini = Math.max(fim - overlap, ini + 1);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
  if (!cfg?.value || req.headers.get("x-cron-secret") !== cfg.value) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });
  }
  let body: { relistar?: boolean } = {};
  try { body = await req.json(); } catch { /* vazio */ }

  try {
    // (1) listagem, uma vez por dia (ou quando pedido)
    const { data: ult } = await supabase.from("internal_config").select("value").eq("key", "atos_compras_listado_em").maybeSingle();
    const listar = body.relistar || !ult?.value || Date.now() - Number(ult.value) > 20 * 3600 * 1000;
    let listados = 0;
    if (listar) {
      for (const s of SECOES) {
        const vistos = new Set<string>();
        for (let b = 0; b < 600; b += 30) {
          let html: string;
          try { html = await baixar(`${BASE}/${s.slug}${b ? `?b_start:int=${b}` : ""}`); } catch { break; }
          const re = new RegExp(`href="(${BASE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/${s.slug}/([^"#?/]+))"`, "g");
          const novos = [...html.matchAll(re)].filter((m) => !vistos.has(m[1]) && !/^(RSS|atom\.xml|rss\.xml)$/i.test(m[2]));
          if (!novos.length) break;
          const rows = [];
          for (const m of novos) {
            vistos.add(m[1]);
            const info = lerSlug(m[2], s.tipo);
            if (info) rows.push({ url: m[1], ...info, vigente: s.vigente, visto_em: new Date().toISOString() });
          }
          if (rows.length) {
            const { error } = await supabase.from("atos_compras").upsert(rows, { onConflict: "url", ignoreDuplicates: false });
            if (error) throw new Error(error.message);
            listados += rows.length;
          }
        }
      }
      await supabase.from("internal_config").upsert({ key: "atos_compras_listado_em", value: String(Date.now()) }, { onConflict: "key" });
    }

    // (2) importa a íntegra de alguns atos vigentes ainda sem texto
    const { data: pendentes } = await supabase.from("atos_compras").select("*").eq("vigente", true).is("knowledge_id", null)
      .order("ano", { ascending: false }).limit(IMPORTAR_POR_EXECUCAO);
    const openai = Deno.env.get("OPENAI_API_KEY");
    let importados = 0;
    for (const a of pendentes || []) {
      try {
        const html = await baixar(a.url);
        const corpo = html.match(/id="content-core"[^>]*>([\s\S]*?)<div[^>]*id="(?:viewlet-below-content|footer)/)?.[1] ?? html;
        const texto = htmlParaTexto(corpo);
        if (texto.length < 300) continue;
        const reference = `${a.tipo} ${a.orgao ? a.orgao + " " : ""}${a.numero}/${a.ano}`;
        const registro = {
          title: `${a.titulo} (íntegra do Portal de Compras)`, reference, year: a.ano, content: texto, active: true, url: a.url,
          source_type: a.tipo === "IN" ? "instrucao_normativa" : "outro",
        };
        // já na base (ex.: IN 58/2022 e IN 65/2021 vêm da importação de legislação): só liga
        const { data: existe } = await supabase.from("legal_knowledge").select("id")
          .ilike("reference", `${a.tipo} %${a.numero}/${a.ano}%`).limit(1).maybeSingle();
        const kn: { id: string } | null = existe ?? (await supabase.from("legal_knowledge").insert(registro).select("id").single()).data;
        if (existe) {                     // já tinha texto e trechos: só registra a ligação
          await supabase.from("atos_compras").update({ knowledge_id: existe.id, importado_em: new Date().toISOString() }).eq("url", a.url);
          importados++;
          continue;
        }
        if (!kn) continue;
        if (openai) {
          const pedacos = fatiar(texto);
          for (let i = 0; i < pedacos.length; i += 40) {
            const lote = pedacos.slice(i, i + 40);
            const r = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST", headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "text-embedding-3-small", input: lote, dimensions: 1536 }),
            });
            if (!r.ok) break;
            const emb = ((await r.json()).data as { index: number; embedding: number[] }[]).sort((x, y) => x.index - y.index);
            await supabase.from("legal_knowledge_chunks").upsert(lote.map((c, j) => ({ knowledge_id: kn!.id, chunk_index: i + j, content: c, embedding: JSON.stringify(emb[j].embedding) })), { onConflict: "knowledge_id,chunk_index" });
          }
        }
        await supabase.from("atos_compras").update({ knowledge_id: kn!.id, importado_em: new Date().toISOString() }).eq("url", a.url);
        importados++;
      } catch { /* segue para o próximo; tenta de novo na próxima execução */ }
    }
    const { count: total } = await supabase.from("atos_compras").select("url", { count: "exact", head: true });
    const { count: comTexto } = await supabase.from("atos_compras").select("url", { count: "exact", head: true }).not("knowledge_id", "is", null);
    return new Response(JSON.stringify({ ok: true, listados, importados, total, comTexto }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502, headers: cors });
  }
});
