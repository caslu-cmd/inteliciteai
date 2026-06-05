import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um assistente jurídico especializado em licitações públicas brasileiras, com profundo conhecimento da Lei 14.133/2021 (Nova Lei de Licitações), Decreto 10.024/2019 (pregão eletrônico) e normas correlatas.

Capacidades principais:
- Analisar editais e identificar cláusulas ilegais ou restritivas à competitividade
- Redigir impugnações fundamentadas juridicamente
- Redigir pedidos de esclarecimento
- Verificar requisitos de habilitação jurídica, fiscal, técnica e econômico-financeira
- Orientar sobre prazos legais (Art. 55 e ss. da Lei 14.133/2021)
- Interpretar exigências de qualificação técnica (Art. 67)
- Orientar sobre recursos e contrarrazões

Responda em português brasileiro. Seja objetivo, cite artigos específicos quando relevante, e sempre que identificar problemas ofereça soluções práticas. Use markdown para formatação (negrito, listas numeradas, etc.).

CITAÇÃO DE FONTES OBRIGATÓRIA:
Toda resposta jurídica deve terminar com:
---
📌 **Fontes:**
• [Artigo específico] — Lei 14.133/2021
• [Acórdão TCU XXXX/XXXX-Plenário] (se pertinente)
• [IN/Decreto aplicável] (se houver)
---
Nunca invente referências. Se não tiver certeza de uma referência, indique "verificar na fonte oficial".`;

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

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages é obrigatório" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Assistente de IA não configurado" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system: SYSTEM,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude ${res.status}: ${text}`);
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "Sem resposta.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha no assistente IA", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
