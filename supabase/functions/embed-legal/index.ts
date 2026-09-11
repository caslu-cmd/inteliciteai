import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunkText(text: string, size = 800, overlap = 120) {
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
    if (end >= text.length) break;   // fim do texto — encerra (evita loop infinito)
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
      .sort((a, b) => a.index - b.index).map(d => d.embedding);
  }
  throw new Error("OpenAI 429 persistente (limite de tokens/min). Tente novamente em 1 minuto.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  // Verificar se é admin
  const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single();
  if (!["admin", "super_admin"].includes(profile?.platform_role ?? "")) return new Response(JSON.stringify({ error: "Apenas admins" }), { status: 403, headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), { status: 503, headers: cors });

  let body: { knowledgeId?: string; indexAll?: boolean };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  try {
    const { data: items, error } = body.knowledgeId
      ? await supabase.from("legal_knowledge").select("id, content").eq("id", body.knowledgeId)
      : body.indexAll
        ? await supabase.from("legal_knowledge").select("id, content").eq("active", true)
        : await supabase.from("legal_knowledge").select("id, content").eq("id", "none");

    if (error || !items?.length) return new Response(JSON.stringify({ indexed: 0 }), { headers: cors });

    let indexed = 0, totalChunks = 0, pulados = 0;
    for (const item of items) {
      // Em "indexar tudo", pula itens que já têm chunks (ex.: leis grandes
      // mantidas automaticamente pela rotina ingest-legislacao) — evita
      // reprocessá-las e estourar o limite da OpenAI.
      if (body.indexAll && !body.knowledgeId) {
        const { count } = await supabase.from("legal_knowledge_chunks")
          .select("*", { count: "exact", head: true }).eq("knowledge_id", item.id);
        if ((count ?? 0) > 0) { pulados++; continue; }
      }

      await supabase.from("legal_knowledge_chunks").delete().eq("knowledge_id", item.id);
      const chunks = chunkText(item.content);
      for (let i = 0; i < chunks.length; i += 40) {
        const batch = chunks.slice(i, i + 40);
        const embeddings = await embedBatch(batch, OPENAI_KEY);
        const rows = batch.map((c, j) => ({
          knowledge_id: item.id,
          chunk_index:  i + j,
          content:      c,
          embedding:    JSON.stringify(embeddings[j]),
        }));
        const { error: insertErr } = await supabase.from("legal_knowledge_chunks")
          .upsert(rows, { onConflict: "knowledge_id,chunk_index" });
        if (insertErr) throw new Error(insertErr.message);
        if (i + 40 < chunks.length) await sleep(1200);
      }
      indexed++;
      totalChunks += chunks.length;
    }

    return new Response(JSON.stringify({ indexed, chunks: totalChunks, pulados }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
