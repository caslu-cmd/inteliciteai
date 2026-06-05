import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Chunk {
  content: string;
  charStart: number;
  charEnd: number;
}

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
    if (content.length > 20) {
      chunks.push({ content, charStart: start, charEnd: end });
    }

    start = end - overlap;
    if (start >= end) start = end; // safety
  }

  return chunks;
}

// Gera embeddings em lote via OpenAI (até 2048 inputs por chamada)
async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
      dimensions: 1536,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error ${res.status}: ${err}`);
  }

  const data = await res.json();
  // Garante a ordem correta (a API retorna ordenado por index)
  return (data.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: corsHeaders });

    const { sourceId, notebookId, content } = await req.json() as {
      sourceId: string;
      notebookId: string;
      content: string;
    };

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY não configurada nos secrets");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Extrai user_id do JWT
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) throw new Error("Token inválido");

    // Remove chunks antigos desta fonte (re-indexação)
    await supabase.from("notebook_chunks").delete().eq("source_id", sourceId);

    // Divide em chunks
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ chunks_count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gera embeddings em lote
    const embeddings = await embedBatch(chunks.map((c) => c.content), OPENAI_KEY);

    // Prepara rows para inserção
    const rows = chunks.map((chunk, i) => ({
      source_id:   sourceId,
      notebook_id: notebookId,
      user_id:     user.id,
      content:     chunk.content,
      chunk_index: i,
      char_start:  chunk.charStart,
      char_end:    chunk.charEnd,
      embedding:   JSON.stringify(embeddings[i]), // pgvector aceita array JSON
    }));

    // Insere em batches de 100 para não exceder limites da API
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("notebook_chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(`Erro ao salvar chunks: ${error.message}`);
    }

    // Marca a fonte como indexada
    await supabase
      .from("notebook_sources")
      .update({ is_embedded: true })
      .eq("id", sourceId);

    return new Response(JSON.stringify({ chunks_count: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
