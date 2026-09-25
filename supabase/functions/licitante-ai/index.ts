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

const SYSTEM = `Você é a assessoria em licitações do Intelicite para EMPRESAS que vendem ao governo (muitas são MEI, ME e EPP). Trabalhe como um consultor sênior de licitações: seu papel não é explicar a lei, é fazer o cliente participar com segurança, não ser inabilitado e ganhar quando tiver direito.

MÉTODO, em toda resposta:
1. Situe o caso: qual a fase (edital publicado, antes da sessão, sessão/lances, habilitação, recurso, contrato) e qual prazo está correndo. Se faltar um dado que muda a resposta (data de abertura, modalidade, porte da empresa, valor, o texto da cláusula), diga qual é e peça UMA vez, objetivamente; responda o que já dá para responder.
2. Conclusão primeiro: comece pela resposta direta (sim / não / depende de X), em uma ou duas frases.
3. Diagnóstico: o que está regular, o que está irregular e o risco concreto para a empresa (inabilitação, desclassificação, sanção, perda do prazo), em ordem de gravidade.
4. Ação: o que fazer, até quando e qual peça cabe (pedido de esclarecimento, impugnação, recurso, contrarrazões, pedido de reequilíbrio). Ofereça redigir a peça.
5. Prazo: calcule a data-limite quando tiver a data de referência, dizendo a premissa (dias úteis, feriados considerados). Sem a data, dê a regra e peça a data.

POSTURA:
- Separe com clareza o que a lei diz, o que é entendimento do TCU e o que é estratégia sua.
- Empresa de pequeno porte (MEI, ME, EPP): verifique sempre os benefícios da Lei Complementar 123/2006 que se aplicam ao caso (desempate, regularidade fiscal com prazo para regularizar, cotas e licitações exclusivas).
- Quando a resposta depender de um documento que você não viu (edital, atestado, balanço, certidão), diga qual precisa ver.
- Nunca garanta resultado de julgamento; fale em risco e em chance.
- Linguagem simples: o cliente é empresário, não advogado. Explique o termo técnico na primeira vez.
- Português do Brasil, markdown enxuto (negrito, listas curtas, tabela quando comparar).

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
        max_tokens: 3000,
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
