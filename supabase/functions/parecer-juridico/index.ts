import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Parecer Jurídico IA: analisa um documento (edital, proposta/habilitação ou
// contrato) com a postura de um advogado de licitações, fundamentando na base
// jurídica indexada (RAG) + Lei 14.133/2021, e devolve um parecer estruturado.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM =`Você é o Advogado IA do Intelicite, especialista em licitações públicas brasileiras (Lei 14.133/2021, Lei 10.520/2002, LC 123/2006, Lei 8.666/1993 e decretos correlatos).
Analise o documento como um advogado faria antes de o cliente participar/assinar.
- Fundamente CADA ponto na legislação (cite artigo/lei) e, quando pertinente, na jurisprudência do TCU/AGU.
- Use a BASE JURÍDICA fornecida como fonte primária; se algo não estiver nela, use seu conhecimento da lei, mas seja preciso.
- Seja objetivo, prático e direto. Aponte riscos reais, cláusulas possivelmente ilegais/restritivas e oportunidades de impugnação.
- NUNCA invente número de artigo ou acórdão. Se não tiver certeza da fonte exata, diga "verificar" em vez de inventar.
Responda SOMENTE com um JSON válido (sem texto fora do JSON, sem markdown), no formato:
{
 "tipoDetectado": "edital|proposta|contrato",
 "veredito": "participar|participar_com_ressalvas|impugnar|nao_recomendado|conforme|ajustes_necessarios",
 "resumo": "2-4 frases com a conclusão geral",
 "pontos": [{"titulo":"", "situacao":"ok|atencao|risco|ilegal", "analise":"", "fundamento":"artigo/lei", "fonte":"ex.: Art. 40 da Lei 14.133/2021"}],
 "impugnacoes": ["pontos passíveis de impugnação (quando edital)"],
 "habilitacao": ["exigências de habilitação a observar / documentos"],
 "prazos": ["prazos relevantes identificados"],
 "recomendacaoFinal": "orientação prática final"
}`;

// deno-lint-ignore no-explicit-any
function extrairJSON(txt: string): any {
  const ini = txt.indexOf("{");
  const fim = txt.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("resposta sem JSON");
  return JSON.parse(txt.slice(ini, fim + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: "IA não configurada" }), { status: 503, headers: cors });

  let body: { texto?: string; tipo?: string; titulo?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }
  const texto = (body.texto || "").trim();
  if (texto.length < 50) return new Response(JSON.stringify({ error: "Envie o texto do documento (mínimo algumas linhas)." }), { status: 400, headers: cors });

  const tipo = body.tipo && body.tipo !== "auto" ? body.tipo : "auto";

  // 1) Contexto jurídico = base indexada (legislação) + jurisprudência TCU/AGU
  //    buscada AO VIVO. Reutiliza a função search-legal (RAG + web search).
  let baseJuridica = "";
  try {
    const q = `${body.titulo || ""} ${texto.slice(0, 1000)}`.trim();
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-legal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
      body: JSON.stringify({ query: q, matchCount: 8, includeWebSearch: true }),
    });
    if (r.ok) {
      const d = await r.json();
      baseJuridica = (d.context || "").trim();
    }
  } catch { /* segue sem contexto externo */ }

  // 2) Monta o prompt e chama a Claude
  const docTrunc = texto.slice(0, 24000);
  const userMsg = [
    tipo !== "auto" ? `Tipo do documento: ${tipo}.` : "Detecte o tipo do documento (edital, proposta/habilitação ou contrato).",
    body.titulo ? `Título/identificação: ${body.titulo}` : "",
    baseJuridica || "(Sem trechos indexados relevantes — use seu conhecimento da Lei 14.133/2021.)",
    "DOCUMENTO A ANALISAR:\n" + docTrunc,
  ].filter(Boolean).join("\n\n");

  let data: { content?: { text?: string }[] };
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    data = await res.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha na IA", detail: String(err) }), { status: 502, headers: cors });
  }

  const raw = data.content?.map((c) => c.text || "").join("") || "";
  let parecer;
  try { parecer = extrairJSON(raw); }
  catch { return new Response(JSON.stringify({ error: "Não foi possível interpretar o parecer", raw: raw.slice(0, 500) }), { status: 502, headers: cors }); }

  return new Response(JSON.stringify({ parecer, temBase: !!baseJuridica, geradoEm: new Date().toISOString() }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
