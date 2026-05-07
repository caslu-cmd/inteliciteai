import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function extractDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match each result block from DuckDuckGo lite HTML
  const resultBlocks = html.match(/<tr[^>]*class="result-link"[\s\S]*?(?=<tr[^>]*class="result-link"|$)/gi) || [];

  // Fallback: try to find links with snippets
  const linkPattern = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{5,200})<\/a>/gi;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  let linkMatch: RegExpExecArray | null;
  let snippetMatch: RegExpExecArray | null;
  const links: { url: string; title: string }[] = [];
  const snippets: string[] = [];

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const url = linkMatch[1];
    const title = stripHtml(linkMatch[2]);
    if (url && title && !url.includes("duckduckgo") && title.length > 10) {
      links.push({ url, title });
    }
  }

  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    snippets.push(stripHtml(snippetMatch[1]));
  }

  for (let i = 0; i < Math.min(links.length, 8); i++) {
    const { url, title } = links[i];
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      results.push({
        title,
        url,
        snippet: snippets[i] || "",
        source: hostname,
      });
    } catch {
      // skip invalid URLs
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: "Query obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchResults: SearchResult[] = [];

    // 1. Try DuckDuckGo lite (simpler HTML, easier to parse)
    try {
      const ddgRes = await fetch(
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; InteliciteBot/1.0)",
            "Accept": "text/html",
          },
        }
      );
      if (ddgRes.ok) {
        const html = await ddgRes.text();
        const extracted = extractDDGResults(html);
        searchResults.push(...extracted);
      }
    } catch {
      // continue to fallback
    }

    // 2. DuckDuckGo JSON API for instant answers / related topics
    let instantAnswer = "";
    let relatedTopics: { title: string; url: string; snippet: string; source: string }[] = [];
    try {
      const jsonRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { headers: { "User-Agent": "InteliciteBot/1.0" } }
      );
      if (jsonRes.ok) {
        const data = await jsonRes.json();
        if (data.AbstractText) instantAnswer = data.AbstractText;
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.FirstURL && topic.Text) {
              try {
                const hostname = new URL(topic.FirstURL).hostname.replace("www.", "");
                relatedTopics.push({
                  title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 80),
                  url: topic.FirstURL,
                  snippet: topic.Text,
                  source: hostname,
                });
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    for (const r of [...searchResults, ...relatedTopics]) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        merged.push(r);
      }
    }

    return new Response(
      JSON.stringify({ results: merged.slice(0, 8), instantAnswer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
