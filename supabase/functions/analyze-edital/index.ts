import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comContexto, contextoPorAssunto } from "../_shared/contexto-juridico.ts";
import { carregarIndice, conferir, contem, normalizar } from "../_shared/verifica-citacoes.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um auditor especializado em editais de licitação brasileiros, com domínio da Lei 14.133/2021.

Analise o edital e retorne SOMENTE um objeto JSON válido neste formato (sem texto antes ou depois):
{
  "score": <inteiro 0-100: chance de vitória considerando complexidade, prazo, valor e exigências>,
  "riskLevel": <"low"|"medium"|"high">,
  "summary": {
    "objeto": "<descrição do objeto>",
    "modalidade": "<modalidade de licitação>",
    "valorEstimado": "<valor em BRL ou 'Sigiloso'>",
    "orgao": "<órgão>",
    "numero": "<número do processo/edital>"
  },
  "prazos": [
    { "label": "<nome>", "date": "<DD/MM/AAAA>", "status": "<past|urgent|upcoming|future>" }
  ],
  "habilitacao": [
    { "categoria": "<Jurídica|Fiscal|Técnica|Econômico-Financeira>", "status": "<apto|risco|nao_atende>", "itens": ["<exigência>"] }
  ],
  "riscos": [
    { "level": "<low|medium|high>", "title": "<título>", "ref": "<Art. X — Lei 14.133/2021, só se estiver na BASE JURÍDICA; senão vazio>", "textoLegal": "<trecho LITERAL de 8 a 30 palavras do dispositivo, copiado da BASE JURÍDICA>", "excerpt": "<trecho literal do EDITAL>" }
  ],
  "recomendacoes": ["<ação recomendada>"]
}

Status de prazo: past=já venceu, urgent=≤3 dias úteis, upcoming=4-10 dias, future=>10 dias.
Riscos de alto nível: ISO/certificação obrigatória desnecessária, capital social >10% do valor, prazo de entrega ≤30 dias, visita técnica obrigatória, atestados com quantidades ≥80% do objeto.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { pdfBase64, text, filename } = body;
  if (!pdfBase64 && !text) {
    return new Response(JSON.stringify({ error: "Forneça pdfBase64 ou text" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Serviço de análise não configurado" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Base jurídica para os riscos (antes a análise citava artigos de memória). Com texto,
  // a busca usa o próprio edital; com PDF, os temas que a análise sempre verifica.
  const temas = [
    "capital mínimo ou patrimônio líquido mínimo exigido na qualificação econômico-financeira",
    "vistoria prévia do local substituída por declaração formal",
    "qualificação técnica documentos exigíveis atestados de capacidade técnica",
    "prazo para impugnar o edital de licitação",
    "indicação de marca ou modelo na descrição do objeto",
    "certificação por organização independente acreditada",
  ];
  const clausulas = text
    ? text.split(/\n(?=\s*\d+(?:\.\d+)*[.)\s-])|\n\s*\n/).map((c: string) => c.replace(/\s+/g, " ").trim()).filter((c: string) => c.length >= 40).slice(0, 6)
    : [];
  const contexto = await contextoPorAssunto([...temas, ...clausulas], req.headers.get("Authorization")!, 3);

  const userContent: any[] = pdfBase64
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }, title: filename || "Edital" },
        { type: "text", text: "Analise este edital e retorne APENAS o JSON estruturado." },
      ]
    : [{ type: "text", text: `Analise o edital a seguir e retorne APENAS o JSON estruturado:\n\n${text.substring(0, 40000)}` }];

  const RETRY_DELAYS = [1000, 2000, 4000];
  const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

  try {
    let res: Response | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: JSON.stringify({
          model: "claude-opus-4-8",
          max_tokens: 2500,
          system: comContexto(SYSTEM, contexto),
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (res.ok) break;

      lastErr = `Claude ${res.status}: ${await res.text()}`;
      if (!RETRYABLE.has(res.status) || attempt === RETRY_DELAYS.length - 1) {
        throw new Error(lastErr);
      }
      console.warn(`[analyze-edital] retry ${attempt + 1}/${RETRY_DELAYS.length} after ${RETRY_DELAYS[attempt]}ms — ${res.status}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    if (!res || !res.ok) throw new Error(lastErr || "Falha desconhecida");

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta sem JSON válido");

    // Conferência automática de cada risco: o dispositivo citado tem de existir na
    // íntegra oficial e o textoLegal tem de estar nele; com texto enviado, o trecho do
    // edital também é conferido. O resultado aparece no próprio rótulo da referência.
    let saida = match[0];
    try {
      const analise = JSON.parse(match[0]);
      const idx = await carregarIndice(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!));
      const edNorm = text ? normalizar(text) : "";
      for (const r of analise.riscos || []) {
        if (!r.ref) { r.ref = "Sem dispositivo citado (orientação, não fundamento legal)"; continue; }
        const cits = conferir(`${r.ref}: "${r.textoLegal || ""}"`, idx);
        const st = cits.some((c) => c.status === "nao_confere") ? "nao_confere"
          : cits.some((c) => c.status === "conferida") ? "conferida" : "sem_trecho";
        r.verificacao = { status: st, citacoes: cits };
        r.ref += st === "conferida" ? " · ✅ conferido no texto oficial"
          : st === "nao_confere" ? " · ❌ NÃO confere com a lei, desconsidere"
          : " · ⚠️ sem trecho para conferir";
        if (text && r.excerpt) r.excerptConfere = contem(edNorm, r.excerpt);
      }
      saida = JSON.stringify(analise);
    } catch { /* a conferência nunca derruba a análise */ }

    return new Response(saida, {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha na análise", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
