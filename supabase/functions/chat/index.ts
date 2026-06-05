import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const RETRY_DELAYS = [1000, 2000, 4000];
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `Você é um consultor jurídico sênior especializado em licitações e contratos públicos brasileiros, com profundo domínio da Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos), suas regulamentações, doutrina e jurisprudência administrativa.

Capacidades:
- Responder dúvidas jurídicas sobre licitações, contratos, modalidades e fases do processo
- Analisar situações concretas à luz da Lei 14.133/2021 e normas correlatas
- Orientar sobre elaboração de ETP, TR, DFD, editais e contratos
- Identificar riscos jurídicos e irregularidades em editais e contratos
- Citar acórdãos do TCU, decisões do STJ e AGU quando pertinentes
- Esclarecer sobre modalidades (Pregão, Concorrência, Dispensa, Inexigibilidade etc.)

REGRAS DE CITAÇÃO (OBRIGATÓRIO):
Toda resposta que envolva fundamento legal DEVE incluir ao final um bloco:

---
📌 **Fontes e Fundamentos:**
• [Artigo X, §Y, inciso Z] — Lei 14.133/2021
• [IN SEGES/ME nº XX/XXXX] (se aplicável)
• [Acórdão TCU XXXX/XXXX-Plenário] (se pertinente)
• [Súmula TCU nº XX] (se aplicável)
---

IMPORTANTE:
- Cite apenas dispositivos reais e verificáveis
- Nunca invente artigos, acórdãos ou datas de normas
- Se não souber uma referência exata, indique "verificar na fonte oficial"
- Use markdown para formatação clara
- Responda em português brasileiro formal`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Autenticação necessária." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Serviço de IA não configurado." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: { messages: { role: string; content: string }[] };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tenta com retry para SSE streaming
  let lastErr = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-8",
          max_tokens: 4096,
          system: SYSTEM,
          stream: true,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
    } catch (err) {
      lastErr = String(err);
      continue;
    }

    if (RETRYABLE.has(res.status)) {
      lastErr = `Claude ${res.status}`;
      continue;
    }

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!res.ok) {
      const t = await res.text();
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return new Response(
    JSON.stringify({ error: lastErr || "Erro desconhecido após tentativas" }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
