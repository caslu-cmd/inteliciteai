import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    { "level": "<low|medium|high>", "title": "<título>", "ref": "<Art. X — Lei 14.133/2021>", "excerpt": "<trecho literal>" }
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

  const userContent: any[] = pdfBase64
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }, title: filename || "Edital" },
        { type: "text", text: "Analise este edital e retorne APENAS o JSON estruturado." },
      ]
    : [{ type: "text", text: `Analise o edital a seguir e retorne APENAS o JSON estruturado:\n\n${text.substring(0, 40000)}` }];

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta sem JSON válido");

    return new Response(match[0], {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha na análise", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
