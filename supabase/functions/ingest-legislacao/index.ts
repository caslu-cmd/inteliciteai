import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Ingestão automática da legislação de licitações direto das fontes oficiais
// (Planalto). Baixa o texto da lei, converte em texto puro, quebra em pedaços,
// gera embeddings (OpenAI) e grava na base jurídica (RAG).
//
// Modos:
//  - { auto: true }           → processa a PRÓXIMA fatia pendente (cursor em
//    internal_config). Ideal para o cron: chamado de tempos em tempos, preenche
//    a base inteira sozinho e depois fica ocioso.
//  - { reset: true }          → zera o cursor (força recomeço da base).
//  - { chave, offset, limite }→ processa uma lei específica (uso manual).
//
// Fatiamento + pausa entre lotes + retry no 429 respeitam o limite de
// tokens/min da OpenAI mesmo em leis grandes.

// deno-lint-ignore no-explicit-any
type SB = any;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Lei { chave: string; title: string; source_type: string; reference: string; year: number; url: string; }

const LEIS: Lei[] = [
  { chave: "l14133", title: "Lei nº 14.133/2021 — Nova Lei de Licitações e Contratos", source_type: "lei", reference: "Lei 14.133/2021", year: 2021, url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm" },
  { chave: "l10520", title: "Lei nº 10.520/2002 — Pregão", source_type: "lei", reference: "Lei 10.520/2002", year: 2002, url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm" },
  { chave: "lcp123", title: "Lei Complementar nº 123/2006 — ME e EPP (tratamento diferenciado)", source_type: "lei", reference: "LC 123/2006", year: 2006, url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm" },
  { chave: "l8666", title: "Lei nº 8.666/1993 — Licitações (legado, ainda referência)", source_type: "lei", reference: "Lei 8.666/1993", year: 1993, url: "https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm" },
  { chave: "d10024", title: "Decreto nº 10.024/2019 — Pregão eletrônico", source_type: "outro", reference: "Decreto 10.024/2019", year: 2019, url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d10024.htm" },
];

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ", "&sect;": "§", "&ordm;": "º", "&ordf;": "ª", "&deg;": "°",
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

const LIMITE_PADRAO = 120;
const TAMANHO_LOTE = 40;
const CURSOR_KEY = "legis_cursor";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function htmlParaTexto(html: string): string {
  let s = html
    .replace(/\r/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = s.replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
  for (const [k, v] of Object.entries(ENTIDADES)) s = s.split(k).join(v);
  s = s.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function chunkText(text: string, size = 800, overlap = 120): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf("Art. ", end));
      if (boundary > start + size - 200) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content.length > 30) chunks.push(content);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 1536 }),
    });
    if (res.status === 429) {
      const txt = await res.text();
      const m = /try again in ([\d.]+)s/i.exec(txt);
      await sleep(Math.min(20000, Math.ceil((m ? Number(m[1]) : 8) * 1000) + 800));
      continue;
    }
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.data as { index: number; embedding: number[] }[])
      .sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
  throw new Error("OpenAI 429 persistente (limite de tokens/min)");
}

async function baixarTexto(url: string, tries = 4): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Intelicite/1.0", Accept: "text/html" } });
      if (!r.ok) { await sleep(700 * (i + 1)); continue; }
      const buf = await r.arrayBuffer();
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const charset = /charset=([^;]+)/.exec(ct)?.[1]?.trim();
      const dec = new TextDecoder(charset === "utf-8" ? "utf-8" : "iso-8859-1");
      return htmlParaTexto(dec.decode(buf));
    } catch (_e) { await sleep(700 * (i + 1)); }
  }
  return "";
}

// Processa uma fatia [offset, offset+limite) de uma lei. Retorna o progresso.
async function processarLei(supabase: SB, apiKey: string, lei: Lei, offset: number, limite: number) {
  const texto = await baixarTexto(lei.url);
  if (texto.length < 500) return { chave: lei.chave, ok: false, motivo: "texto vazio/curto na fonte" };

  const chunks = chunkText(texto);
  const total = chunks.length;

  const { data: existente } = await supabase.from("legal_knowledge").select("id, content").eq("reference", lei.reference).maybeSingle();
  let knowledgeId: string | undefined = existente?.id;
  if (offset === 0) {
    if (knowledgeId) {
      // Já indexado e sem mudança na fonte? Pula (não gasta embeddings da OpenAI).
      const { count } = await supabase.from("legal_knowledge_chunks")
        .select("*", { count: "exact", head: true }).eq("knowledge_id", knowledgeId);
      if (existente.content === texto && total > 0 && (count ?? 0) >= total) {
        return { chave: lei.chave, ok: true, reference: lei.reference, total, processadosAte: total, concluido: true, inalterado: true };
      }
      await supabase.from("legal_knowledge").update({ title: lei.title, source_type: lei.source_type, year: lei.year, content: texto, active: true }).eq("id", knowledgeId);
      await supabase.from("legal_knowledge_chunks").delete().eq("knowledge_id", knowledgeId);
    } else {
      const { data: novo, error: insErr } = await supabase.from("legal_knowledge")
        .insert({ title: lei.title, source_type: lei.source_type, reference: lei.reference, year: lei.year, content: texto, active: true })
        .select("id").single();
      if (insErr || !novo) throw new Error(insErr?.message || "falha ao inserir");
      knowledgeId = novo.id;
    }
  } else if (!knowledgeId) {
    throw new Error("offset>0 sem registro base");
  }

  const fim = Math.min(offset + limite, total);
  for (let i = offset; i < fim; i += TAMANHO_LOTE) {
    const batch = chunks.slice(i, Math.min(i + TAMANHO_LOTE, fim));
    const embeddings = await embedBatch(batch, apiKey);
    const rows = batch.map((c, j) => ({ knowledge_id: knowledgeId, chunk_index: i + j, content: c, embedding: JSON.stringify(embeddings[j]) }));
    const { error: chErr } = await supabase.from("legal_knowledge_chunks").upsert(rows, { onConflict: "knowledge_id,chunk_index" });
    if (chErr) throw new Error(chErr.message);
    if (i + TAMANHO_LOTE < fim) await sleep(1200);
  }
  return { chave: lei.chave, ok: true, reference: lei.reference, total, processadosAte: fim, concluido: fim >= total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cronSecret = req.headers.get("x-cron-secret");
  let autorizado = false;
  if (cronSecret) {
    const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", "cron_secret").single();
    autorizado = !!cfg?.value && cronSecret === cfg.value;
  } else {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single();
        autorizado = ["admin", "super_admin"].includes(profile?.platform_role ?? "");
      }
    }
  }
  if (!autorizado) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), { status: 503, headers: cors });

  let body: { chave?: string; offset?: number; limite?: number; auto?: boolean; reset?: boolean } = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const limite = Math.max(1, Number(body.limite) || LIMITE_PADRAO);

  const salvarCursor = async (idx: number, offset: number) =>
    supabase.from("internal_config").upsert({ key: CURSOR_KEY, value: JSON.stringify({ idx, offset }) }, { onConflict: "key" });

  try {
    // Reset: recomeça a base do zero.
    if (body.reset) {
      await salvarCursor(0, 0);
      return new Response(JSON.stringify({ ok: true, reset: true, restam: LEIS.length }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Auto: processa a próxima fatia pendente e avança o cursor.
    if (body.auto) {
      // Lock: evita que duas execuções (ex.: dois disparos do cron) processem
      // a mesma fatia ao mesmo tempo.
      const agora = Date.now();
      const { data: lk } = await supabase.from("internal_config").select("value").eq("key", "legis_lock").maybeSingle();
      if (lk?.value && agora - Number(lk.value) < 180000) {
        return new Response(JSON.stringify({ ok: true, busy: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      await supabase.from("internal_config").upsert({ key: "legis_lock", value: String(agora) }, { onConflict: "key" });
      try {
        const { data: cur } = await supabase.from("internal_config").select("value").eq("key", CURSOR_KEY).maybeSingle();
        let { idx, offset } = cur?.value ? JSON.parse(cur.value) : { idx: 0, offset: 0 };
        if (idx >= LEIS.length) {
          return new Response(JSON.stringify({ ok: true, concluidoTudo: true }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        const r = await processarLei(supabase, OPENAI_KEY, LEIS[idx], offset, limite);
        if (r.ok && r.concluido) { idx += 1; offset = 0; }
        else if (r.ok) { offset = r.processadosAte as number; }
        else { idx += 1; offset = 0; } // fonte falhou: pula para não travar o cron
        await salvarCursor(idx, offset);
        return new Response(JSON.stringify({ ok: true, ...r, proximo: { idx, offset }, leis: LEIS.length, concluidoTudo: idx >= LEIS.length }), { headers: { ...cors, "Content-Type": "application/json" } });
      } finally {
        await supabase.from("internal_config").upsert({ key: "legis_lock", value: "0" }, { onConflict: "key" });
      }
    }

    // Manual: uma lei específica.
    const lei = LEIS.find((l) => l.chave === body.chave);
    if (!lei) return new Response(JSON.stringify({ error: "Informe 'chave' ou use auto/reset", leis: LEIS.map((l) => ({ chave: l.chave, title: l.title })) }), { status: 400, headers: cors });
    const r = await processarLei(supabase, OPENAI_KEY, lei, Math.max(0, Number(body.offset) || 0), limite);
    return new Response(JSON.stringify(r), { status: r.ok ? 200 : 502, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
