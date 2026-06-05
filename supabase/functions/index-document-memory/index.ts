import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function chunkText(text: string, size = 1000, overlap = 150) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end));
      if (boundary > start + size - 200) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content.length > 50) chunks.push(content);
    start = end - overlap;
    if (start >= end) start = end;
  }
  return chunks;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: cors });

  let body: { documentId: string; municipalityId: string; tipo: string; content: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  const { documentId, municipalityId, tipo, content } = body;
  if (!documentId || !municipalityId || !content) {
    return new Response(JSON.stringify({ ok: false, reason: "campos obrigatórios ausentes" }), { headers: cors });
  }

  try {
    // Remove índice antigo deste documento
    await supabase.from("organ_memory_chunks").delete().eq("document_id", documentId);

    const chunks = chunkText(content);
    if (chunks.length === 0) return new Response(JSON.stringify({ chunks_count: 0 }), { headers: cors });

    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      const embeddings = await embedBatch(batch, OPENAI_KEY);
      const rows = batch.map((c, j) => ({
        municipality_id: municipalityId,
        document_id:     documentId,
        document_tipo:   tipo,
        chunk_index:     i + j,
        content:         c,
        embedding:       JSON.stringify(embeddings[j]),
      }));
      const { error } = await supabase.from("organ_memory_chunks").insert(rows);
      if (error) throw new Error(error.message);
    }

    return new Response(JSON.stringify({ ok: true, chunks_count: chunks.length }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
