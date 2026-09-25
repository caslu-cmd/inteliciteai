import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { comContexto, contextoJuridico } from "../_shared/contexto-juridico.ts";
import { carregarIndice, PEDIDO_REESCRITA, respostaSegura } from "../_shared/verifica-citacoes.ts";
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
- SEMPRE forneça a fonte concreta com o link oficial quando disponível — especialmente
  a jurisprudência trazida pela busca web (use as URLs presentes no contexto).
- NUNCA responda apenas "verifique na fonte oficial" sem dar o caminho. Em vez disso,
  forneça o endereço oficial onde consultar, por exemplo:
  • Leis e decretos → https://www.planalto.gov.br
  • Acórdãos e súmulas do TCU → https://portal.tcu.gov.br (Pesquisa de Jurisprudência)
  • Orientações e pareceres da AGU → https://www.gov.br/agu
  • Instruções normativas (SEGES/ME) → https://www.gov.br/compras
  Se houver a URL exata da fonte no contexto, cite-a diretamente no bloco de Fontes.
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

  const contexto = await contextoJuridico(messages, authHeader);
  const historico = messages.map((m) => ({ role: m.role, content: m.content }));

  // Chamada sem stream, com as mesmas retentativas de antes.
  const chamar = async (msgs: { role: string; content: string }[]): Promise<string> => {
    let lastErr = "";
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
      let res: Response;
      try {
        res = await fetch(ANTHROPIC_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 4096, system: comContexto(SYSTEM, contexto), messages: msgs }),
        });
      } catch (err) { lastErr = String(err); continue; }
      if (RETRYABLE.has(res.status)) { lastErr = `Claude ${res.status}`; continue; }
      if (!res.ok) throw new Error(res.status === 429 ? "Limite de requisições excedido. Tente novamente em alguns instantes." : "Erro no serviço de IA. Tente novamente.");
      return (await res.json()).content?.map((c: { text?: string }) => c.text || "").join("") || "";
    }
    throw new Error(lastErr || "Erro no serviço de IA. Tente novamente.");
  };

  // Nada de texto antes da conferência: o usuário nunca vê citação inexistente, nem
  // por um instante. A resposta começa na hora com comentários SSE (": ...", ignorados
  // pela tela) para o gateway não cortar, e o texto só sai depois de conferido e limpo.
  const enc = new TextEncoder();
  const evento = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(": conferindo\n\n"));
      const pulso = setInterval(() => controller.enqueue(enc.encode(": conferindo\n\n")), 10000);
      let texto: string;
      try {
        texto = await chamar(historico);
        try {
          const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          const fontes = contexto + "\n" + messages.map((m) => m.content).join("\n");
          const r = await respostaSegura(texto, await carregarIndice(admin), fontes, (falhas, anterior) =>
            chamar([...historico, { role: "assistant", content: anterior }, { role: "user", content: PEDIDO_REESCRITA(falhas) }]), admin);
          texto = r.texto + (r.rodape ? "\n" + r.rodape : "");
        } catch {
          texto += "\n\n---\n\n⚠️ **A conferência automática ficou indisponível nesta resposta.** Não use números de artigo, lei ou acórdão sem conferir no texto oficial.";
        }
      } catch (err) {
        texto = `⚠️ ${(err as Error)?.message || "Não foi possível responder agora. Tente novamente."}`;
      }
      clearInterval(pulso);
      controller.enqueue(evento({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: texto } }));
      controller.enqueue(evento({ type: "message_stop" }));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
