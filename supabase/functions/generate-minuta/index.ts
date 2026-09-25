import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { comContexto, contextoPorAssunto } from "../_shared/contexto-juridico.ts";
import { carregarIndice, PEDIDO_REESCRITA, respostaSegura } from "../_shared/verifica-citacoes.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_IMPUGNACAO = `Você é um advogado especializado em licitações públicas com domínio da Lei 14.133/2021.
Redija uma IMPUGNAÇÃO AO EDITAL formal, completa e tecnicamente fundamentada.

Estrutura obrigatória:
1. EXCELENTÍSSIMO(A) SENHOR(A) [CARGO DO PREGOEIRO/COMISSÃO]
2. Identificação: [RAZÃO SOCIAL], CNPJ [____], representada por [____], vem impugnar o Edital do [MODALIDADE E NÚMERO], com fundamento no Art. 164 da Lei 14.133/2021, pelos motivos abaixo expostos.
3. I – DOS FATOS (descreva a cláusula ou exigência questionada)
4. II – DO DIREITO (cite artigos específicos da Lei 14.133/2021 e jurisprudência do TCU quando aplicável)
5. III – DO PEDIDO (solicite alteração, supressão ou esclarecimento da cláusula)
6. Nestes termos, pede deferimento.
7. Local e data: [____________________]
8. Assinatura: [____________________]

Use linguagem jurídica formal. Cite artigos específicos. Deixe colchetes [  ] onde dados devem ser preenchidos.

CITAÇÃO DE FONTES OBRIGATÓRIA:
Ao final do documento inclua:
> 📌 **Fundamentos:** [Artigos aplicáveis] — Lei 14.133/2021 | [Acórdão TCU pertinente, se houver]
Cite apenas dispositivos reais e verificáveis.`;

const SYSTEM_ESCLARECIMENTO = `Você é um advogado especializado em licitações públicas com domínio da Lei 14.133/2021.
Redija um PEDIDO DE ESCLARECIMENTO formal ao edital.

Estrutura obrigatória:
1. ILMO(A). SR(A). PREGOEIRO(A)/PRESIDENTE DA COMISSÃO
2. Identificação e referência ao edital
3. Dúvida ou inconsistência identificada (seja específico)
4. Base legal para o pedido (Art. 164, caput, Lei 14.133/2021)
5. Questionamentos específicos (liste as dúvidas claramente)
6. Pedido formal de resposta dentro do prazo legal
7. Local e data: [____________________]
8. Assinatura: [____________________]

Use linguagem clara e respeitosa. Deixe colchetes [  ] onde dados devem ser preenchidos.

CITAÇÃO DE FONTES OBRIGATÓRIA:
Ao final inclua:
> 📌 **Fundamentos:** Art. 164 — Lei 14.133/2021 | [outros artigos aplicáveis]
Cite apenas dispositivos reais.`;

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

  const { tipo, edital, orgao, clausula, motivo } = body;
  if (!tipo || !edital || !clausula) {
    return new Response(JSON.stringify({ error: "tipo, edital e clausula são obrigatórios" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Serviço de IA não configurado" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = tipo === "impugnacao" ? SYSTEM_IMPUGNACAO : SYSTEM_ESCLARECIMENTO;
  const docTipo = tipo === "impugnacao" ? "impugnação" : "pedido de esclarecimento";

  const userPrompt = `Gere uma ${docTipo} para:

Edital: ${edital}
Órgão: ${orgao || "não informado"}
Cláusula/Item questionado: ${clausula}
Motivo/Fundamentação adicional: ${motivo || "conforme a legislação vigente"}

Gere o documento completo, pronto para uso.`;

  // Base jurídica recuperada para a cláusula questionada (antes a peça era redigida de memória).
  const auth = req.headers.get("Authorization")!;
  const contexto = await contextoPorAssunto([
    clausula,
    motivo || "",
    tipo === "impugnacao" ? "impugnação do edital prazo Art. 164" : "pedido de esclarecimento sobre os termos do edital Art. 164",
  ], auth, 5);
  const system = comContexto(systemPrompt, contexto);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const chamar = async (messages: { role: string; content: string }[]) => {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 3000, system, messages }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    return (await res.json()).content?.[0]?.text ?? "";
  };

  try {
    const idx = await carregarIndice(admin);
    // Peça que vai ser protocolada: confere na íntegra oficial, a IA reescreve UMA vez com
    // o que falhou e o que ainda não conferir é removido do texto antes de entregar.
    const primeira = await chamar([{ role: "user", content: userPrompt }]);
    const r = await respostaSegura(primeira, idx, contexto, (falhas, anterior) => chamar([
      { role: "user", content: userPrompt },
      { role: "assistant", content: anterior },
      { role: "user", content: PEDIDO_REESCRITA(falhas) },
    ]), admin);
    const { texto: conteudo, citacoes, jurisprudencia, normas } = r;

    const ok = citacoes.filter((c) => c.status === "conferida").map((c) => c.rotulo);
    const removidas = citacoes.some((c) => c.status === "nao_confere") || normas.some((n) => !n.ok) || jurisprudencia.some((j) => !j.ok);
    const baseLegal = (ok.length ? ok.slice(0, 4).join("; ") : "Lei 14.133/2021") +
      (removidas ? " · ATENÇÃO: citação removida do texto, revise antes de protocolar" : "");
    const verificacao = r.rodape.replace(/^\s*---\s*/, "").trim();

    const titulo = tipo === "impugnacao"
      ? `Impugnação — ${edital}`
      : `Pedido de Esclarecimento — ${edital}`;

    return new Response(JSON.stringify({ titulo, conteudo, baseLegal, verificacao, citacoes, jurisprudencia }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao gerar documento", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
