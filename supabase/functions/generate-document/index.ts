import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const RETRY_DELAYS = [1000, 2000, 4000];
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_ETP = `Você é um especialista sênior em contratações públicas com domínio da Lei 14.133/2021.
Redija um ESTUDO TÉCNICO PRELIMINAR (ETP) completo, técnico, formal e juridicamente fundamentado conforme Art. 18, §1º da Lei 14.133/2021 e IN SEGES/ME nº 58/2022.

ESTRUTURA OBRIGATÓRIA (todas as seções devem ser plenamente desenvolvidas):
1. IDENTIFICAÇÃO DO DOCUMENTO (cabeçalho completo com órgão, setor, responsáveis, processo, data)
2. DESCRIÇÃO DA NECESSIDADE DA CONTRATAÇÃO (Art. 18, §1º, I — responda obrigatoriamente: por que contratar, para que contratar, para quem contratar, que interesse público será atendido, o que se busca resolver)
3. DEMONSTRAÇÃO DA PREVISÃO NO PCA (Art. 18, §1º, II — Plano de Contratações Anual, DFD)
4. REQUISITOS DA CONTRATAÇÃO (Art. 18, §1º, III — técnicos, sustentabilidade, qualidade, habilitação)
5. ESTIMATIVAS DAS QUANTIDADES (Art. 18, §1º, IV — com memória de cálculo detalhada)
6. LEVANTAMENTO DE MERCADO (Art. 18, §1º, V — alternativas avaliadas, benchmarking)
7. ESTIMATIVA DO VALOR DA CONTRATAÇÃO (Art. 18, §1º, VI — fontes, metodologia, pesquisa de preços, preços unitários referenciais)
8. DESCRIÇÃO DA SOLUÇÃO COMO UM TODO (Art. 18, §1º, VII — arquitetura da solução)
9. JUSTIFICATIVAS PARA PARCELAMENTO OU NÃO DA SOLUÇÃO (Art. 18, §1º, VII)
10. DEMONSTRATIVO DOS RESULTADOS PRETENDIDOS (Art. 18, §1º, VIII — benefícios esperados, indicadores mensuráveis)
11. PROVIDÊNCIAS A SEREM ADOTADAS PELA ADMINISTRAÇÃO (Art. 18, §1º, IX)
12. CONTRATAÇÕES CORRELATAS E/OU INTERDEPENDENTES (Art. 18, §1º, XI)
13. DESCRIÇÃO DE POSSÍVEIS IMPACTOS AMBIENTAIS E MEDIDAS MITIGADORAS (Art. 18, §1º, XII — logística reversa, baixo consumo energético, reciclagem)
14. POSICIONAMENTO CONCLUSIVO SOBRE A VIABILIDADE E RAZOABILIDADE DA CONTRATAÇÃO (Art. 18, §1º, XIII)

INSTRUÇÕES:
- Use linguagem técnica e formal em português brasileiro
- Cite os dispositivos legais aplicáveis em cada seção
- Expanda as informações fornecidas com fundamentos técnicos e jurídicos adequados
- Onde dados específicos não foram informados, use [A PREENCHER PELO ÓRGÃO]
- Formate em markdown com títulos numerados, subtítulos e listas bem estruturadas
- O documento deve ter nível profissional para apresentação a autoridades e controle externo`;

const SYSTEM_TR = `Você é um especialista sênior em contratações públicas com domínio da Lei 14.133/2021.
Redija um TERMO DE REFERÊNCIA (TR) completo, técnico, formal e juridicamente fundamentado conforme Art. 6º, XXIII e Art. 40 da Lei 14.133/2021.

ESTRUTURA OBRIGATÓRIA (todas as seções devem ser plenamente desenvolvidas):
1. IDENTIFICAÇÃO DO DOCUMENTO (cabeçalho, número do TR, processo, data, responsáveis)
2. DEFINIÇÃO DO OBJETO (Art. 40, I — descrição precisa, suficiente e clara, código CATMAT/CATSER)
3. FUNDAMENTAÇÃO DA CONTRATAÇÃO (Art. 40, II — referência ao ETP, dispositivos legais)
4. DESCRIÇÃO DA SOLUÇÃO COMO UM TODO (Art. 40, III — solução completa incluindo requisitos)
5. REQUISITOS DA CONTRATAÇÃO (Art. 40, III — técnicos, sustentabilidade, normas, habilitação)
6. MODELO DE EXECUÇÃO DO OBJETO (Art. 40, IV — prazos, locais, condições, cronograma, subcontratação)
7. MODELO DE GESTÃO DO CONTRATO (Art. 40, V — fiscalização, recebimento provisório e definitivo)
8. CRITÉRIOS DE MEDIÇÃO E PAGAMENTO (Art. 40, V — aferição, prazo e forma de pagamento)
9. FORMA E CRITÉRIOS DE SELEÇÃO DO FORNECEDOR (Art. 40, VI e VII — modalidade, critério, modo de disputa)
10. ESTIMATIVAS DO VALOR DA CONTRATAÇÃO (Art. 40, VIII — valor, tabela de preços unitários)
11. ADEQUAÇÃO ORÇAMENTÁRIA (Art. 40, IX — programa de trabalho, elemento de despesa)
12. OBRIGAÇÕES DA CONTRATANTE E DA CONTRATADA (Art. 40, X e XI)
13. SANÇÕES E INFRAÇÕES ADMINISTRATIVAS (Art. 40, XII — Arts. 155 a 163 da Lei 14.133/2021)
14. GARANTIA CONTRATUAL (Art. 96 — percentual, modalidade, prazo)
15. DISPOSIÇÕES GERAIS (vigência, prorrogação, rescisão, publicação)

INSTRUÇÕES:
- Use linguagem técnica e formal em português brasileiro
- Cite os dispositivos legais aplicáveis em cada seção
- Expanda as informações fornecidas com fundamentos técnicos e jurídicos adequados
- Onde dados específicos não foram informados, use [A PREENCHER PELO ÓRGÃO]
- Formate em markdown com títulos numerados, subtítulos e listas bem estruturadas
- O documento deve ter nível profissional para apresentação a autoridades e controle externo`;

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

const SYSTEM_SUGESTAO = `Você é um especialista em contratações públicas com domínio da Lei 14.133/2021. Ao receber o nome de um campo de documento oficial (ETP ou TR) e o contexto atual preenchido, sugira um texto técnico, formal e juridicamente fundamentado para aquele campo específico. Retorne APENAS o texto sugerido, sem explicações, sem prefixos como "Sugiro:", sem markdown, sem meta-comentários. O texto deve ser pronto para inserção direta no campo do formulário, escrito na terceira pessoa ou forma impessoal conforme documentos públicos oficiais.`;

const SYSTEM_NOTEBOOK_PRECOS = `Você é um especialista em pesquisa de preços para contratações públicas brasileiras. Analise as fontes de conhecimento fornecidas e extraia referências de preços para os itens listados. Retorne APENAS um JSON válido no formato especificado, sem texto adicional.`;

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
      if (RETRYABLE.has(res.status)) { lastErr = new Error(`Claude ${res.status}`); continue; }
      return res;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr;
}

function buildETPPrompt(f: any): string {
  const v = (x: any, label: string) => x ? `${label}: ${x}` : `${label}: [não informado]`;
  return `Gere o ETP completo com base nos seguintes dados:

IDENTIFICAÇÃO:
${v(f.orgao, "Órgão/Entidade")}
${v(f.cnpjOrgao, "CNPJ")}
${v(f.unidade, "Unidade Administrativa")}
${v(f.setor, "Setor Requisitante")}
${v(f.responsavel, "Responsável")}
${v(f.cargo, "Cargo")}
${v(f.matricula, "Matrícula")}
${v(f.processoSEI, "Nº do Processo")}
${v(f.dataElaboracao, "Data de Elaboração")}

NECESSIDADE DA CONTRATAÇÃO:
${v(f.descricaoNecessidade, "Descrição da Necessidade")}
${v(f.problemaSolucionar, "Problema a Solucionar")}
${v(f.publicoBeneficiado, "Público Beneficiado")}
${v(f.quantidadeUsuarios, "Quantidade de Beneficiários")}
${v(f.previsaoPCA, "Previsão no PCA")}
${v(f.numeroPCA, "Nº no PCA/DFD")}
${v(f.alinhamentoEstrategico, "Alinhamento Estratégico")}
${v(f.instrumentoPlanejamento, "Instrumento de Planejamento")}
${f.porQueContratar ? `Por que contratar: ${f.porQueContratar}` : ""}
${f.paraQueContratar ? `Para que contratar: ${f.paraQueContratar}` : ""}
${f.paraQuemContratar ? `Para quem contratar: ${f.paraQuemContratar}` : ""}
${f.interessePublico ? `Interesse público atendido: ${f.interessePublico}` : ""}
${f.oqueBuscaResolver ? `O que se busca resolver: ${f.oqueBuscaResolver}` : ""}

REQUISITOS DA CONTRATAÇÃO:
${v(f.requisitosNegocio, "Requisitos de Negócio")}
${v(f.requisitosTecnicos, "Requisitos Técnicos")}
${v(f.sustentabilidade, "Requisitos de Sustentabilidade")}
${v(f.qualidade, "Requisitos de Qualidade")}
${v(f.segurancaInformacao, "Segurança da Informação")}
${v(f.habilitacaoEspecifica, "Habilitação Específica")}

QUANTIDADES E LEVANTAMENTO DE MERCADO:
${v(f.descricaoItens, "Descrição dos Itens/Quantitativos")}
${v(f.memoriaCalculo, "Memória de Cálculo")}
${Array.isArray(f.aquisicaoItems) && f.aquisicaoItems.length > 0
  ? `Formas de Aquisição Avaliadas (Art. 44):\n${f.aquisicaoItems.map((i: any) =>
      `  - ${i.modalidade}: custo ${i.custoEstimado || "—"} | vantagens: ${i.vantagens || "—"} | desvantagens: ${i.desvantagens || "—"}`
    ).join("\n")}\nModalidade Escolhida: ${f.modalidadeEscolhida || "[não informada]"}`
  : ""}
${v(f.alternativasAvaliadas, "Alternativas de Mercado Avaliadas")}
${v(f.solucaoEscolhida, "Justificativa da Solução Escolhida")}
${v(f.decisaoParcelamento, "Decisão sobre Parcelamento")}
${v(f.justificativaParcelamento, "Justificativa do Parcelamento")}

ESTIMATIVA DO VALOR:
${v(f.valorEstimado ? "R$ " + f.valorEstimado : null, "Valor Total Estimado")}
${v(f.fontePesquisa1, "Fonte de Pesquisa Principal")}
${v(f.fontePesquisa2, "Fonte de Pesquisa Complementar")}
${v(f.metodologiaPesquisa, "Metodologia da Pesquisa")}
${v(f.dataPesquisa, "Data da Pesquisa")}
${v(f.catmatCatser, "Código CATMAT/CATSER")}
${v(f.naturezaDespesa, "Natureza da Despesa")}
${v(f.dotacaoOrcamentaria, "Dotação Orçamentária")}

RISCOS, IMPACTOS AMBIENTAIS E CONTRATAÇÕES CORRELATAS:
${v(f.riscosIdentificados, "Riscos Identificados")}
${v(f.probabilidadeImpacto, "Probabilidade e Impacto")}
${v(f.medidasMitigacao, "Medidas de Mitigação")}
${v(f.impactosAmbientais, "Impactos Ambientais e Medidas Mitigadoras")}
${v(f.contratacaoCorrelatas, "Contratações Correlatas")}
${v(f.interdependentes, "Contratações Interdependentes")}
${v(f.providencias, "Providências Administrativas")}

RESULTADOS E POSICIONAMENTO CONCLUSIVO:
${v(f.resultadosPretendidos, "Resultados Pretendidos")}
${v(f.indicadoresDesempenho, "Indicadores de Desempenho")}
${v(f.beneficiosEsperados, "Benefícios Esperados")}
${v(f.viabilidade, "Posicionamento sobre Viabilidade")}
${v(f.justificativaViabilidade, "Justificativa do Posicionamento")}

Gere o ETP completo em markdown, com todas as 14 seções desenvolvidas conforme Art. 18, §1º da Lei 14.133/2021 e IN SEGES/ME nº 58/2022. Expanda cada informação fornecida com linguagem técnica formal e fundamentos jurídicos. Cite os dispositivos legais em cada seção.`;
}

function buildTRPrompt(f: any): string {
  const v = (x: any, label: string) => x ? `${label}: ${x}` : `${label}: [não informado]`;
  return `Gere o TR completo com base nos seguintes dados:

IDENTIFICAÇÃO:
${v(f.orgao, "Órgão/Entidade")}
${v(f.unidade, "Unidade Administrativa")}
${v(f.numeroProcesso, "Nº do Processo")}
${v(f.numeroTR, "Nº do TR")}
${v(f.responsavel, "Responsável")}
${v(f.cargo, "Cargo")}
${v(f.referenciaETP, "Referência ao ETP")}
${v(f.dataElaboracao, "Data de Elaboração")}

OBJETO E FUNDAMENTAÇÃO:
${v(f.objeto, "Definição do Objeto")}
${v(f.naturezaObjeto, "Natureza do Objeto")}
${v(f.catmatCatser, "Código CATMAT/CATSER")}
${v(f.fundamentacaoLegal, "Fundamentação Legal")}
${v(f.modalidadePrevista, "Modalidade Prevista")}
${v(f.tipoContratacao, "Tipo de Contratação")}

ESPECIFICAÇÕES E REQUISITOS:
${v(f.especificacoesTecnicas, "Especificações Técnicas")}
${v(f.normasTecnicas, "Normas Técnicas")}
${v(f.sustentabilidade, "Requisitos de Sustentabilidade")}
${v(f.amostra, "Exige Amostra")}
${v(f.habilitacaoJuridica, "Habilitação Jurídica")}
${v(f.habilitacaoTecnica, "Habilitação Técnica")}
${v(f.qualificacaoFinanceira, "Qualificação Econômico-financeira")}
${v(f.indices, "Índices Financeiros Mínimos")}

MODELO DE EXECUÇÃO:
${v(f.prazoExecucao && f.unidadePrazo ? f.prazoExecucao + " " + f.unidadePrazo : f.prazoExecucao, "Prazo de Execução")}
${v(f.localExecucao, "Local de Execução/Entrega")}
${v(f.formaEntrega, "Forma de Entrega")}
${v(f.cronograma, "Cronograma de Etapas")}
${v(f.subcontratacao, "Subcontratação")}
${v(f.percentualSubcontratacao, "Percentual de Subcontratação")}
${v(f.condicoesEspeciais, "Condições Especiais")}

GESTÃO CONTRATUAL:
${v(f.fiscalTecnico, "Fiscal Técnico")}
${v(f.fiscalAdministrativo, "Fiscal Administrativo")}
${v(f.recebimentoProvisorio ? f.recebimentoProvisorio + " dias" : null, "Prazo Recebimento Provisório")}
${v(f.recebimentoDefinitivo ? f.recebimentoDefinitivo + " dias" : null, "Prazo Recebimento Definitivo")}
${v(f.criterioMedicao, "Critério de Medição")}
${v(f.prazoPagamento ? f.prazoPagamento + " dias" : null, "Prazo de Pagamento")}
${v(f.formaPagamento, "Forma de Pagamento")}
${v(f.documentosCobranca, "Documentos de Cobrança")}

SELEÇÃO DO FORNECEDOR:
${v(f.modalidade, "Modalidade Licitatória")}
${v(f.criterioJulgamento, "Critério de Julgamento")}
${v(f.modoDisputa, "Modo de Disputa")}
${v(f.validadeProposta ? f.validadeProposta + " dias" : null, "Validade da Proposta")}
${v(f.exigeAmostraPrevia, "Exige Amostra Prévia")}
${v(f.exigeCartaSolidariedade, "Exige Carta de Solidariedade")}

VALOR, ORÇAMENTO E SANÇÕES:
${v(f.valorEstimado ? "R$ " + f.valorEstimado : null, "Valor Total Estimado")}
${v(f.valorMaximoUnitario, "Valores Unitários Máximos")}
${v(f.programaTrabalho, "Programa de Trabalho")}
${v(f.elementoDespesa, "Elemento de Despesa")}
${v(f.obrigacoesContratada, "Obrigações da Contratada")}
${v(f.obrigacoesContratante, "Obrigações da Contratante")}
${v(f.garantia, "Garantia Contratual")}
${v(f.sancoes, "Sanções Administrativas")}
${v(f.vigenciaContrato ? f.vigenciaContrato + " meses" : null, "Vigência Contratual")}
${v(f.prorrogacao, "Possibilidade de Prorrogação")}

Gere o TR completo em markdown, com todas as 15 seções desenvolvidas conforme Art. 6º, XXIII e Art. 40 da Lei 14.133/2021. Expanda cada informação fornecida com linguagem técnica formal e fundamentos jurídicos. Cite os dispositivos legais em cada seção.`;
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
  let maxTokens = 8192;

  if (tipo === "etp") {
    systemPrompt = SYSTEM_ETP;
    userPrompt = buildETPPrompt(formData);

  } else if (tipo === "tr") {
    systemPrompt = SYSTEM_TR;
    userPrompt = buildTRPrompt(formData);

  } else if (tipo === "cotacao") {
    systemPrompt = SYSTEM_COTACAO;
    maxTokens = 2048;
    userPrompt = `Analise os seguintes itens para pesquisa de preços em compras governamentais:

${JSON.stringify(formData.itens, null, 2)}

Margem de lucro aplicada: ${formData.margem || 15}%
Impostos aplicados: ${formData.impostos || 8.65}%

Forneça faixas de preço de mercado e recomendações para a pesquisa de preços conforme IN SEGES/ME nº 65/2021.`;

  } else if (tipo === "sugestao") {
    systemPrompt = SYSTEM_SUGESTAO;
    maxTokens = 800;
    const campo = formData.campo || "campo desconhecido";
    const tipoDoc = formData.tipoDocumento || "ETP";
    const ctx = formData.contexto || {};
    const aquisicaoStr = Array.isArray(ctx.aquisicaoItems) && ctx.aquisicaoItems.length > 0
      ? `\nFormas de aquisição avaliadas (Art. 44 da Lei 14.133/2021):\n${ctx.aquisicaoItems.map((item: any) =>
          `- ${item.modalidade}: custo estimado ${item.custoEstimado || "não informado"} | vantagens: ${item.vantagens || "—"} | desvantagens: ${item.desvantagens || "—"}`
        ).join("\n")}`
      : "";
    const ctxStr = Object.entries(ctx)
      .filter(([k, v]) => k !== "aquisicaoItems" && v && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`)
      .slice(0, 20)
      .join("\n");
    userPrompt = `Tipo de documento: ${tipoDoc}
Campo a preencher: ${campo}

Contexto atual do formulário:
${ctxStr || "(formulário vazio)"}${aquisicaoStr}

Sugira o conteúdo para o campo "${campo}" com linguagem técnica e formal adequada para um documento de contratação pública.`;

  } else if (tipo === "notebookPrecos") {
    systemPrompt = SYSTEM_NOTEBOOK_PRECOS;
    maxTokens = 2048;
    const items = formData.itens || [];
    const fontes = formData.fontes || [];
    const sourcesText = fontes.length > 0
      ? fontes.map((s: any, i: number) => `### [Fonte ${i + 1}] ${s.title}\n${String(s.content).slice(0, 4000)}`).join("\n\n---\n\n")
      : "(nenhuma fonte disponível)";
    userPrompt = `Fontes de conhecimento do Notebook IA:

${sourcesText}

---

Itens para pesquisa de preços:
${items.map((item: any, i: number) => `${i + 1}. ${item.descricao || "Item sem descrição"} — Quantidade: ${item.quantidade || 1} ${item.unidade || "UN"}`).join("\n")}

Analise as fontes acima e retorne as referências de preço encontradas para cada item. Formato obrigatório:
{
  "referencias": [
    { "itemIndex": 0, "referencia": "Fonte X — R$ 999,00 (mês/ano)", "valorUnitario": "999.00" }
  ]
}
Regras: itemIndex começa em 0; omita itens sem referência encontrada; valorUnitario é string numérica com ponto decimal e 2 casas; referencia deve citar o nome da fonte e o valor/período encontrado.`;

  } else {
    return new Response(JSON.stringify({ error: "tipo deve ser etp, tr, cotacao, sugestao ou notebookPrecos" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const claudeBody: any = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  };

  if (stream && (tipo === "etp" || tipo === "tr")) {
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
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Falha ao gerar documento (stream)", detail: String(err) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const res = await callClaude(apiKey, claudeBody);
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "";

    if (tipo === "cotacao" || tipo === "notebookPrecos") {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Resposta sem JSON válido");
      return new Response(match[0], { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ conteudo: raw }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao processar", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
