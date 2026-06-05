import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ chunks: [], context: "" }), { headers: cors });

  let body: { query: string; municipalityId: string; matchCount?: number };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  const { query, municipalityId, matchCount = 5 } = body;
  if (!query?.trim() || !municipalityId) {
    return new Response(JSON.stringify({ chunks: [], context: "" }), { headers: cors });
  }

  try {
    const queryEmbedding = await embedQuery(query, OPENAI_KEY);

    const { data: chunks, error: rpcErr } = await supabase.rpc("match_regulation_chunks", {
      query_embedding:   queryEmbedding,
      p_municipality_id: municipalityId,
      match_count:       matchCount,
      min_similarity:    0.20,
    });

    if (rpcErr) throw new Error(rpcErr.message);

    const context = chunks && chunks.length > 0
      ? `REGULAMENTOS DO ÓRGÃO APLICÁVEIS:\n${chunks.map((c: any, i: number) => `[${i + 1}] ${c.content}`).join("\n\n")}`
      : "";

    return new Response(JSON.stringify({ chunks: chunks ?? [], context }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
