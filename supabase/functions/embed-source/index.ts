import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Indexa uma fonte do Notebook: divide o conteúdo em chunks, gera embeddings
// (OpenAI text-embedding-3-small) e grava em notebook_chunks. O conteúdo é
// lido do banco (não do payload) e a fonte precisa pertencer ao usuário.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Chunk { content: string; charStart: number; charEnd: number }

// Divide o texto em chunks com overlap para garantir contexto nas bordas
function chunkText(text: string, size = 800, overlap = 120): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    // Tenta terminar o chunk em quebra de linha ou ponto final para manter coerência
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf("? ", end),
        text.lastIndexOf("! ", end),
      );
      if (boundary > start + size - 200) end = boundary + 1;
    }

    const content = text.slice(start, end).trim();
    if (content.length > 20) chunks.push({ content, charStart: start, charEnd: end });

    start = end - overlap;
    if (start >= end) start = end; // safety
  }

  return chunks;
}

// Gera embeddings em lotes de até 256 textos por chamada
async function embedAll(texts: string[], apiKey: string): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 256) {
    const batch = texts.slice(i, i + 256);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: batch, dimensions: 1536 }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const sorted = (data.data as { index: number; embedding: number[] }[])
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
    out.push(...sorted);
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  let sourceId = "";
  try { ({ sourceId } = await req.json()); } catch { /* handled below */ }
  if (!sourceId) return json({ error: "sourceId obrigatório" }, 400);

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY não configurada nos secrets" }, 503);

  // A fonte precisa ser do usuário; o conteúdo vem do banco, não do cliente
  const { data: source } = await supabase
    .from("notebook_sources")
    .select("id, notebook_id, content")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!source) return json({ error: "Fonte não encontrada" }, 404);

  const setStatus = (fields: Record<string, unknown>) =>
    supabase.from("notebook_sources").update(fields).eq("id", sourceId);

  try {
    await setStatus({ embed_status: "processing", embed_error: null });

    // Re-indexação: remove chunks antigos desta fonte (só os do próprio usuário)
    await supabase.from("notebook_chunks").delete().eq("source_id", sourceId).eq("user_id", user.id);

    const chunks = chunkText(source.content || "");
    if (chunks.length === 0) {
      await setStatus({ embed_status: "done", is_embedded: true, chunk_count: 0 });
      return json({ chunks_count: 0 });
    }

    const embeddings = await embedAll(chunks.map((c) => c.content), OPENAI_KEY);

    const rows = chunks.map((chunk, i) => ({
      source_id:   sourceId,
      notebook_id: source.notebook_id,
      user_id:     user.id,
      content:     chunk.content,
      chunk_index: i,
      char_start:  chunk.charStart,
      char_end:    chunk.charEnd,
      embedding:   JSON.stringify(embeddings[i]), // pgvector aceita array JSON
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("notebook_chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(`Erro ao salvar chunks: ${error.message}`);
    }

    await setStatus({ embed_status: "done", is_embedded: true, chunk_count: chunks.length });
    return json({ chunks_count: chunks.length });
  } catch (err) {
    const message = (err as Error).message;
    await setStatus({ embed_status: "error", is_embedded: false, embed_error: message.slice(0, 500) });
    return json({ error: message }, 500);
  }
});
