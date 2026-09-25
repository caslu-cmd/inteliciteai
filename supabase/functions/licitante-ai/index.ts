import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comContexto, contextoJuridico } from "../_shared/contexto-juridico.ts";
import { carregarIndice, PEDIDO_REESCRITA, respostaSegura } from "../_shared/verifica-citacoes.ts";
import { jsonComPulso } from "../_shared/pulso.ts";

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
Cite o dispositivo exato (Art., §, inciso, lei) junto de cada afirmação jurídica, no corpo do texto.
Nunca invente referências. NÃO escreva links nem bloco de fontes: a plataforma confere cada citação
no texto oficial e acrescenta automaticamente, ao final, as "Fontes oficiais" com o link de verificação.`;

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

  const contexto = await contextoJuridico(messages, req.headers.get("Authorization")!);

  const historico = messages.map((m: any) => ({ role: m.role, content: m.content }));
  const chamar = async (msgs: { role: string; content: string }[]) => {
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
        system: comContexto(SYSTEM, contexto),
        messages: msgs,
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    return (await res.json()).content?.[0]?.text ?? "Sem resposta.";
  };

  return jsonComPulso(async () => {
    let reply = await chamar(historico);

    // Conferência automática (código): confere na íntegra oficial, deixa a IA reescrever
    // UMA vez com o que falhou e remove do texto o que ainda não conferir.
    let verificacao = null;
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const fontes = contexto + "\n" + messages.map((m: { content: string }) => m.content).join("\n");
      const r = await respostaSegura(reply, await carregarIndice(admin), fontes, (falhas, anterior) =>
        chamar([...historico, { role: "assistant", content: anterior }, { role: "user", content: PEDIDO_REESCRITA(falhas) }]), admin);
      reply = r.texto + (r.rodape ? "\n" + r.rodape : "");
      verificacao = { citacoes: r.citacoes, jurisprudencia: r.jurisprudencia, normas: r.normas };
    } catch {
      reply += "\n\n---\n\n⚠️ **A conferência automática ficou indisponível nesta resposta.** Não use números de artigo, lei ou acórdão sem conferir no texto oficial.";
    }

    return { reply, verificacao };
  }, cors);
});
