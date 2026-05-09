import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const RETRY_DELAYS = [1000, 2000, 4000];
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_ETP = `Você é um especialista em contratações públicas com domínio da Lei 14.133/2021.
Redija um ESTUDO TÉCNICO PRELIMINAR (ETP) completo, técnico e fundamentado conforme Art. 18, §1º da Lei 14.133/2021.

Estrutura obrigatória (todas as seções devem ser desenvolvidas):
1. DESCRIÇÃO DA NECESSIDADE DA CONTRATAÇÃO (problema a ser resolvido)
2. DEMONSTRAÇÃO DA PREVISÃO NO PCA (Plano de Contratações Anual)
3. REQUISITOS DA CONTRATAÇÃO (técnicos, sustentáveis, de qualidade)
4. ESTIMATIVAS DAS QUANTIDADES (com memória de cálculo)
5. LEVANTAMENTO DE MERCADO (alternativas avaliadas)
6. ESTIMATIVA DO VALOR DA CONTRATAÇÃO (com fontes de pesquisa de preço)
7. DESCRIÇÃO DA SOLUÇÃO COMO UM TODO
8. JUSTIFICATIVAS PARA PARCELAMENTO OU NÃO DA SOLUÇÃO
9. DEMONSTRATIVO DOS RESULTADOS PRETENDIDOS
10. PROVIDÊNCIAS A SEREM ADOTADAS PELA ADMINISTRAÇÃO
11. CONTRATAÇÕES CORRELATAS E/OU INTERDEPENDENTES
12. POSICIONAMENTO CONCLUSIVO SOBRE A VIABILIDADE E RAZOABILIDADE DA CONTRATAÇÃO

Use linguagem técnica formal em markdown. Cite o Art. 18 da Lei 14.133/2021 e a IN SEGES/ME nº 58/2022. Deixe colchetes [  ] onde dados específicos devem ser preenchidos.`;

const SYSTEM_TR = `Você é um especialista em contratações públicas com domínio da Lei 14.133/2021.
Redija um TERMO DE REFERÊNCIA (TR) completo conforme Art. 6º, XXIII e Art. 40 da Lei 14.133/2021.

Estrutura obrigatória:
1. DEFINIÇÃO DO OBJETO (descrição precisa, suficiente e clara)
2. FUNDAMENTAÇÃO DA CONTRATAÇÃO (referência ao ETP)
3. DESCRIÇÃO DA SOLUÇÃO COMO UM TODO
4. REQUISITOS DA CONTRATAÇÃO (sustentabilidade, normas técnicas)
5. MODELO DE EXECUÇÃO DO OBJETO (prazos, locais, condições)
6. MODELO DE GESTÃO DO CONTRATO (fiscalização, recebimento)
7. CRITÉRIOS DE MEDIÇÃO E PAGAMENTO
8. FORMA E CRITÉRIOS DE SELEÇÃO DO FORNECEDOR (modalidade, critério de julgamento, modo de disputa)
9. ESTIMATIVAS DO VALOR DA CONTRATAÇÃO
10. ADEQUAÇÃO ORÇAMENTÁRIA
11. OBRIGAÇÕES DA CONTRATANTE E DA CONTRATADA
12. SANÇÕES E INFRAÇÕES ADMINISTRATIVAS

Use linguagem técnica formal em markdown. Cite o Art. 40 da Lei 14.133/2021. Deixe colchetes [  ] onde dados específicos devem ser preenchidos.`;

const SYSTEM_COTACAO = `Você é um especialista em pesquisa de preços para contratações públicas brasileiras.
Com base nos itens fornecidos, analise e sugira:
1. Faixas de preço de mercado para cada item (baseado em padrões de compras governamentais)
2. Alertas sobre itens com preços potencialmente fora da média
3. Recomendações para pesquisa de preços conforme IN SEGES/ME nº 65/2021
4. Estimativa de custo total com margem de segurança

Retorne APENAS um JSON válido:
{
  "itens": [
    { "descricao": "...", "faixaMin": 0, "faixaMax": 0, "referencia": "..." }
  ],
  "alertas": ["..."],
  "recomendacoes": ["..."],
  "totalEstimado": 0
}`;

async function callClaude(apiKey: string, body: object): Promise<Response> {
  let lastErr: Error = new Error("unknown");
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (RETRYABLE.has(res.status)) {
        lastErr = new Error(`Claude ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr;
}

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

  const { tipo, formData, stream = false } = body;
  if (!tipo || !formData) {
    return new Response(JSON.stringify({ error: "tipo e formData são obrigatórios" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Serviço de IA não configurado" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let systemPrompt: string;
  let userPrompt: string;

  if (tipo === "etp") {
    systemPrompt = SYSTEM_ETP;
    userPrompt = `Gere o ETP completo com base nos seguintes dados:

Órgão: ${formData.orgao || "não informado"}
Setor Requisitante: ${formData.setor || "não informado"}
Responsável: ${formData.responsavel || "não informado"}
Objeto da Contratação: ${formData.objeto || "não informado"}
Previsão de Contratação: ${formData.previsaoContratacao ? formData.previsaoContratacao + " dias" : "não informado"}
Descrição da Necessidade: ${formData.descricaoNecessidade || "não informado"}
Área Requisitante: ${formData.areaRequisitante || "não informado"}
Alinhamento Estratégico: ${formData.alinhamentoEstrategico || "não informado"}
Requisitos de Negócio: ${formData.requisitosNegocio || "não informado"}
Requisitos Técnicos: ${formData.requisitosTecnicos || "não informado"}
Estimativa de Custo: ${formData.estimativaCusto ? "R$ " + formData.estimativaCusto : "não informado"}
Fonte da Pesquisa: ${formData.fontePesquisa || "não informado"}
Riscos Principais: ${formData.riscosPrincipais || "não informado"}
Medidas de Mitigação: ${formData.mitigacao || "não informado"}

Gere o documento completo em markdown, com todas as seções desenvolvidas, formal e pronto para revisão.`;

  } else if (tipo === "tr") {
    systemPrompt = SYSTEM_TR;
    userPrompt = `Gere o TR completo com base nos seguintes dados:

Órgão: ${formData.orgao || "não informado"}
Objeto: ${formData.objeto || "não informado"}
Justificativa: ${formData.justificativa || "não informado"}
Especificações Técnicas: ${formData.especificacoes || "não informado"}
Quantitativos: ${formData.quantitativos || "não informado"}
Prazo de Execução: ${formData.prazoExecucao || "não informado"}
Local de Entrega/Execução: ${formData.localEntrega || "não informado"}
Obrigações da Contratada: ${formData.obrigacoesContratada || "não informado"}
Obrigações da Contratante: ${formData.obrigacoesContratante || "não informado"}
Critérios de Aceitação: ${formData.criterioAceitacao || "não informado"}
Sanções: ${formData.sancoes || "não informado"}

Gere o documento completo em markdown, com todas as seções desenvolvidas, formal e pronto para revisão.`;

  } else if (tipo === "cotacao") {
    systemPrompt = SYSTEM_COTACAO;
    userPrompt = `Analise os seguintes itens para pesquisa de preços em compras governamentais:

${JSON.stringify(formData.itens, null, 2)}

Margem de lucro aplicada: ${formData.margem || 15}%
Impostos aplicados: ${formData.impostos || 8.65}%

Forneça faixas de preço de mercado e recomendações para a pesquisa de preços.`;

  } else {
    return new Response(JSON.stringify({ error: "tipo deve ser etp, tr ou cotacao" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const claudeBody: any = {
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };

  // Streaming mode for ETP/TR
  if (stream && tipo !== "cotacao") {
    claudeBody.stream = true;
    try {
      const res = await callClaude(apiKey, claudeBody);
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Claude ${res.status}`, detail: err }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(res.body, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Falha ao gerar documento (stream)", detail: String(err) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  // Non-streaming mode
  try {
    const res = await callClaude(apiKey, claudeBody);
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "";

    if (tipo === "cotacao") {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Resposta sem JSON válido");
      return new Response(match[0], { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ conteudo: raw }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao gerar documento", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
