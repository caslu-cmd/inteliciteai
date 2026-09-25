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

// Busca jurisprudência via Brave Search (provedor principal, tem plano grátis),
// restrita aos portais oficiais do TCU/AGU e a resultados do último ano.
async function webSearchBrave(query: string, braveKey: string): Promise<string> {
  const jurQuery = `site:portal.tcu.gov.br OR site:agu.gov.br "${query}" licitação Lei 14133`;
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(jurQuery)}&count=5&freshness=py`,
    { headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": braveKey } },
  );
  if (!res.ok) return "";
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  return (data.web?.results || [])
    .slice(0, 5)
    .map((r: any) => `• ${r.title}: ${r.description} (${r.url})`)
    .join("\n");
}

// Reserva: busca jurisprudência do TCU/AGU usando a busca web NATIVA do Claude
// (server-side tool web_search), restrita aos domínios oficiais. Usa a mesma
// ANTHROPIC_API_KEY que o chat já usa — sem provedor externo de busca.
async function webSearchJurisprudencia(query: string, anthropicKey: string): Promise<string> {
  const tools = [{
    type: "web_search_20260209",
    name: "web_search",
    max_uses: 3,
    allowed_domains: ["portal.tcu.gov.br", "pesquisa.apps.tcu.gov.br", "www.gov.br", "gov.br"],
  }];

  const prompt =
    `Busque jurisprudência recente e relevante do TCU (acórdãos, súmulas) e da AGU sobre: "${query}", ` +
    `no contexto da Lei nº 14.133/2021 (licitações e contratos públicos). ` +
    `Liste de forma objetiva os achados, cada um com: número do acórdão/súmula, ano, a tese/entendimento e a URL da fonte oficial. ` +
    `Cite apenas o que encontrar nas fontes; não invente. Se não houver nada relevante, responda apenas: SEM RESULTADOS.`;

  // deno-lint-ignore no-explicit-any
  let convo: any[] = [{ role: "user", content: prompt }];

  // web_search pode gerar pause_turn (execução server-side); continuamos até 3x.
  for (let i = 0; i < 3; i++) {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 1500, tools, messages: convo }),
    });
    if (!res.ok) return "";
    const data = await res.json();

    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      // deno-lint-ignore no-explicit-any
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    if (data.stop_reason === "pause_turn") {
      convo = [...convo, { role: "assistant", content: data.content }];
      continue;
    }

    return text && !/^SEM RESULTADOS/i.test(text) ? text : "";
  }
  return "";
}

// Artigo citado pelo número ("art. 63", "artigo 164"): a busca vetorial nem sempre
// devolve o trecho certo, então o texto EXATO do artigo sai da íntegra da Lei 14.133
// indexada. Evita a IA citar de memória justamente o dispositivo que o usuário pediu.
// deno-lint-ignore no-explicit-any
async function artigosCitados(query: string, supabase: any): Promise<string> {
  const nums = [...new Set([...query.matchAll(/\bart(?:igo)?s?\.?\s*(\d{1,3})\b/gi)].map((m) => Number(m[1])))].slice(0, 3);
  if (!nums.length) return "";
  const { data } = await supabase.from("legal_knowledge").select("content")
    .ilike("title", "Lei nº 14.133%").eq("active", true).limit(1).maybeSingle();
  if (!data?.content) return "";
  const lei = data.content.replace(/\s+/g, " ");
  const trechos = nums.map((n) => {
    const ini = lei.search(new RegExp(`Art\\. ?${n}(º|\\.)? `));
    if (ini < 0) return "";
    const resto = lei.slice(ini + 6);
    const prox = resto.search(new RegExp(`Art\\. ?${n + 1}(º|\\.)? `));
    return lei.slice(ini, ini + 6 + (prox > 0 ? Math.min(prox, 6000) : 3000));
  }).filter(Boolean);
  return trechos.length ? `TEXTO OFICIAL DOS ARTIGOS CITADOS (Lei 14.133/2021, íntegra do Planalto):\n${trechos.join("\n\n")}` : "";
}

// Os trechos das leis indexadas na íntegra são cortados por tamanho, no meio do
// artigo, e chegam sem o cabeçalho "Art. N". Sem ele a IA não sabe o número e
// chuta. Aqui cada trecho ganha o rótulo "[Lei · Art. N]", achando o último
// cabeçalho de artigo que aparece antes dele no texto integral.
const integras = new Map<string, { title: string; content: string }>();
// deno-lint-ignore no-explicit-any
async function rotularChunks(chunks: { knowledge_id: string; content: string }[], supabase: any): Promise<string[]> {
  const faltam = [...new Set(chunks.map((c) => c.knowledge_id))].filter((id) => !integras.has(id));
  if (faltam.length) {
    const { data } = await supabase.from("legal_knowledge").select("id, title, content").in("id", faltam);
    for (const d of data || []) integras.set(d.id, { title: d.title, content: d.content || "" });
  }
  const CAB = /(?:^|\n)\s*Art\.\s*(\d{1,3})\s*(?:º|o|\.|-|\s)/g;
  return chunks.map((c) => {
    const doc = integras.get(c.knowledge_id);
    if (!doc || doc.content.length < 20000) return "";           // resumo curto: já traz a referência no texto
    const lei = doc.title.split(/\s[—-]\s/)[0].trim();
    let pos = doc.content.indexOf(c.content);
    if (pos < 0) pos = doc.content.indexOf(c.content.slice(0, 120));
    if (pos < 0) return `[${lei}]`;
    const antes = [...doc.content.slice(Math.max(0, pos - 40000), pos).matchAll(CAB)].pop();
    const dentro = [...c.content.matchAll(CAB)].map((m) => m[1]);
    const arts = [...new Set([...(antes ? [antes[1]] : []), ...dentro])];
    if (!arts.length) return `[${lei}]`;
    return `[${lei} · ${arts.length === 1 ? `Art. ${arts[0]}` : `Arts. ${arts[0]} a ${arts[arts.length - 1]}`}]`;
  });
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
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const BRAVE_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");

  let legalContext = "";
  let webContext = "";

  // Busca vetorial na base local (Lei 14.133 + acórdãos/súmulas cadastrados)
  if (OPENAI_KEY) {
    try {
      const queryEmbedding = await embedQuery(query, OPENAI_KEY);
      const { data: chunks } = await supabase.rpc("match_legal_knowledge", {
        query_embedding: queryEmbedding,
        match_count:     matchCount,
        min_similarity:  0.22,
      });
      if (chunks?.length > 0) {
        const rotulos = await rotularChunks(chunks, supabase).catch(() => chunks.map(() => ""));
        legalContext = `BASE JURÍDICA INTELICITE:\n${chunks.map((c: { content: string }, i: number) => `[${i + 1}]${rotulos[i] ? ` ${rotulos[i]}` : ""} ${c.content}`).join("\n\n")}`;
      }
    } catch { /* continua sem contexto local */ }
  }

  // Jurisprudência atual do TCU/AGU (se habilitado): Brave como principal
  // (tem plano grátis); busca nativa do Claude como reserva automática.
  if (includeWebSearch) {
    try {
      let results = "";
      if (BRAVE_KEY) results = await webSearchBrave(query, BRAVE_KEY);
      if (!results && ANTHROPIC_KEY) results = await webSearchJurisprudencia(query, ANTHROPIC_KEY);
      if (results) webContext = `JURISPRUDÊNCIA ATUAL (TCU/AGU, busca web):\n${results}`;
    } catch { /* continua sem web search */ }
  }

  const artigosContext = await artigosCitados(query, supabase).catch(() => "");

  const context = [artigosContext, legalContext, webContext].filter(Boolean).join("\n\n---\n\n");

  return new Response(JSON.stringify({ context, hasLocal: !!legalContext, hasWeb: !!webContext }), { headers: cors });
});
