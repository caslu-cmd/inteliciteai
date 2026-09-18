import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Busca na web para o Notebook (DuckDuckGo lite + API JSON). Exige usuário
// autenticado — antes era um endpoint aberto.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// O HTML "lite" do DuckDuckGo alterna linhas: <a class="result-link"> e, em
// seguida, <td class="result-snippet">. Percorremos na ordem em que aparecem
// para parear link e snippet com segurança.
function extractDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const tokenPattern = /<a[^>]+class="result-link"[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  let pending: { url: string; title: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(html)) !== null && results.length < 8) {
    if (m[1]) {
      if (pending) results.push(toResult(pending, ""));
      const title = stripHtml(m[2]);
      pending = title.length > 3 && !m[1].includes("duckduckgo") ? { url: m[1], title } : null;
    } else if (m[3] !== undefined && pending) {
      results.push(toResult(pending, stripHtml(m[3])));
      pending = null;
    }
  }
  if (pending && results.length < 8) results.push(toResult(pending, ""));
  return results;
}

function toResult(link: { url: string; title: string }, snippet: string): SearchResult {
  let source = "";
  try { source = new URL(link.url).hostname.replace("www.", ""); } catch { /* ignore */ }
  return { title: link.title, url: link.url, snippet, source };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  let query = "";
  try { ({ query } = await req.json()); } catch { return json({ error: "JSON inválido" }, 400); }
  query = (query || "").trim().slice(0, 300);
  if (!query) return json({ error: "Query obrigatória" }, 400);

  const searchResults: SearchResult[] = [];

  // 1. DuckDuckGo lite (HTML simples)
  try {
    const ddgRes = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InteliciteBot/1.0)", "Accept": "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (ddgRes.ok) searchResults.push(...extractDDGResults(await ddgRes.text()));
  } catch { /* segue para o fallback */ }

  // 2. API JSON do DuckDuckGo (resposta instantânea + tópicos relacionados)
  let instantAnswer = "";
  const relatedTopics: SearchResult[] = [];
  try {
    const jsonRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { "User-Agent": "InteliciteBot/1.0" }, signal: AbortSignal.timeout(10_000) },
    );
    if (jsonRes.ok) {
      const data = await jsonRes.json();
      if (data.AbstractText) instantAnswer = data.AbstractText;
      for (const topic of (data.RelatedTopics || []).slice(0, 5)) {
        if (topic.FirstURL && topic.Text) {
          relatedTopics.push(toResult(
            { url: topic.FirstURL, title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 80) },
            topic.Text,
          ));
        }
      }
    }
  } catch { /* ignore */ }

  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...searchResults, ...relatedTopics]) {
    if (!seen.has(r.url)) { seen.add(r.url); merged.push(r); }
  }

  return json({ results: merged.slice(0, 8), instantAnswer });
});
