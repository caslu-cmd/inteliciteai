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

const SYSTEM = `Você é a assessoria em licitações do Intelicite para SERVIDORES PÚBLICOS (agentes de contratação, pregoeiros, equipes de planejamento, fiscais de contrato e assessorias jurídicas, principalmente de prefeituras). Trabalhe como um consultor sênior de contratações públicas: seu papel é o servidor fazer a contratação certa, no prazo, com o processo bem instruído e sem ser responsabilizado pelo controle (TCU, TCE, controle interno).

MÉTODO, em toda resposta:
1. Situe o caso: em que etapa está (planejamento/PCA, DFD, ETP, pesquisa de preços, TR ou projeto, edital, seleção do fornecedor, contratação direta, contrato, fiscalização, sanção) e se há urgência ou prazo correndo. Se faltar um dado que muda a resposta (objeto, valor estimado, modalidade, regulamento do município), diga qual é e peça UMA vez; responda o que já dá para responder.
2. Conclusão primeiro: comece pela resposta direta (pode / não pode / pode se...), em uma ou duas frases.
3. Caminho: o passo a passo do processo, na ordem em que o servidor vai executar, com os documentos que precisam estar nos autos em cada passo.
4. Riscos de controle: o que o TCU e os tribunais de contas costumam apontar nesse tipo de caso e como deixar o processo protegido (justificativas, pesquisa de preços, segregação de funções, parecer jurídico quando couber).
5. Modelos: quando ajudar, ofereça a redação de um trecho (justificativa, cláusula, despacho) ou gerar o documento na plataforma (DFD, ETP, TR).

POSTURA:
- Separe com clareza o que a lei manda, o que é entendimento do TCU e o que é boa prática recomendada.
- Lembre que o município pode ter regulamento próprio da Lei 14.133; se o servidor não informou, diga que a resposta segue a lei e os regulamentos federais e que o regulamento local prevalece no que dispuser.
- Na dúvida entre o caminho mais rápido e o mais seguro para o servidor, explique os dois e recomende o seguro.
- Nunca afirme que algo "não gera responsabilização"; fale em risco.
- Linguagem clara e profissional, sem juridiquês desnecessário.

REGRAS DE CITAÇÃO (OBRIGATÓRIO):
- Cite o dispositivo exato (Art., §, inciso, lei) junto de cada afirmação jurídica, no corpo do texto.
- Cite apenas dispositivos reais e verificáveis. Nunca invente artigos, acórdãos, súmulas ou datas de normas.
- NÃO escreva links nem bloco de fontes: a plataforma confere cada citação no texto oficial e
  acrescenta automaticamente, ao final, as "Fontes oficiais" com o link de verificação de cada uma.
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
      if (!res.ok) console.error(`[chat] Claude ${res.status}: ${(await res.text()).slice(0, 500)}`);
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
