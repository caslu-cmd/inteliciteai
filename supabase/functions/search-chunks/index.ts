import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Busca semântica nos chunks do Notebook. A RPC roda com o JWT do usuário
// (SECURITY INVOKER + RLS + auth.uid() dentro da função), então não há como
// consultar chunks de outro usuário.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000), dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  // Cliente com o JWT do usuário: a RPC enxerga auth.uid() e respeita a RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  let body: { query?: string; sourceIds?: string[]; matchCount?: number } = {};
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const query = body.query?.trim() || "";
  const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds.filter((s) => typeof s === "string") : [];
  if (!query || sourceIds.length === 0) return json({ chunks: [] });

  const matchCount = Math.min(40, Math.max(1, Number(body.matchCount) || 8));

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY não configurada" }, 503);

  try {
    const queryEmbedding = await embedQuery(query, OPENAI_KEY);

    const { data: chunks, error: rpcErr } = await supabase.rpc("match_notebook_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      p_source_ids:    sourceIds,
      match_count:     matchCount,
      min_similarity:  0.20,
    });
    if (rpcErr) throw new Error(`Busca vetorial falhou: ${rpcErr.message}`);

    return json({ chunks: chunks ?? [] });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
