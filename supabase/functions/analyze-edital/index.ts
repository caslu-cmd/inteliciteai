import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, fileName } = await req.json();
    if (!text || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Texto do PDF muito curto ou vazio. Verifique se o PDF contém texto legível." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Truncate to ~30k chars to stay within context limits
    const truncatedText = text.substring(0, 30000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um auditor jurídico especializado em licitações públicas brasileiras e na Lei 14.133/2021. 
Analise o texto do edital fornecido e identifique não-conformidades, riscos e pontos de atenção.
Para cada achado, classifique a severidade como "alta", "media" ou "baixa".
Responda EXCLUSIVAMENTE usando a função analyze_findings.`,
          },
          {
            role: "user",
            content: `Analise o seguinte edital de licitação (arquivo: ${fileName || "edital.pdf"}) e identifique todas as não-conformidades com a Lei 14.133/2021:\n\n${truncatedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_findings",
              description: "Retorna os achados de conformidade do edital analisado",
              parameters: {
                type: "object",
                properties: {
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: {
                          type: "string",
                          enum: ["alta", "media", "baixa"],
                          description: "Nível de risco do achado",
                        },
                        title: {
                          type: "string",
                          description: "Título curto do achado (máx 60 caracteres)",
                        },
                        description: {
                          type: "string",
                          description: "Descrição detalhada do problema encontrado",
                        },
                        article: {
                          type: "string",
                          description: "Artigo da Lei 14.133/2021 relacionado",
                        },
                      },
                      required: ["severity", "title", "description", "article"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["findings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_findings" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "A IA não retornou resultados estruturados. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const findings = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(findings), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-edital error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
