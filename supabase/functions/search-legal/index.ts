import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

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

async function webSearch(query: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=py`, {
    headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": apiKey },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data.web?.results || [])
    .slice(0, 5)
    .map((r: any) => `• ${r.title}: ${r.description} (${r.url})`)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  let body: { query: string; matchCount?: number; includeWebSearch?: boolean };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  const { query, matchCount = 6, includeWebSearch = false } = body;
  if (!query?.trim()) return new Response(JSON.stringify({ context: "", chunks: [] }), { headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  const BRAVE_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");

  let legalContext = "";
  let webContext = "";

  // Busca vetorial na base local
  if (OPENAI_KEY) {
    try {
      const queryEmbedding = await embedQuery(query, OPENAI_KEY);
      const { data: chunks } = await supabase.rpc("match_legal_knowledge", {
        query_embedding: queryEmbedding,
        match_count:     matchCount,
        min_similarity:  0.22,
      });
      if (chunks?.length > 0) {
        legalContext = `BASE JURÍDICA INTELICITE:\n${chunks.map((c: any, i: number) => `[${i + 1}] ${c.content}`).join("\n\n")}`;
      }
    } catch { /* continua sem contexto local */ }
  }

  // Web search para jurisprudência atual (se habilitado e com chave)
  if (includeWebSearch && BRAVE_KEY) {
    try {
      const jurQuery = `site:portal.tcu.gov.br OR site:agu.gov.br "${query}" licitação Lei 14133`;
      const results = await webSearch(jurQuery, BRAVE_KEY);
      if (results) webContext = `JURISPRUDÊNCIA WEB:\n${results}`;
    } catch { /* continua sem web search */ }
  }

  const context = [legalContext, webContext].filter(Boolean).join("\n\n---\n\n");

  return new Response(JSON.stringify({ context, hasLocal: !!legalContext, hasWeb: !!webContext }), { headers: cors });
});
