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

Use linguagem técnica formal. Cite o Art. 18 da Lei 14.133/2021 e a IN SEGES/ME nº 58/2022. Deixe colchetes [  ] onde dados específicos devem ser preenchidos.`;

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

Use linguagem técnica formal. Cite o Art. 40 da Lei 14.133/2021. Deixe colchetes [  ] onde dados específicos devem ser preenchidos.`;

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

  const { tipo, titulo, orgao, objeto, form_data } = body;
  if (!tipo || !["etp", "tr"].includes(tipo) || !objeto) {
    return new Response(JSON.stringify({ error: "tipo (etp|tr) e objeto são obrigatórios" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Serviço de IA não configurado" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = tipo === "etp" ? SYSTEM_ETP : SYSTEM_TR;
  const docTipo = tipo === "etp" ? "Estudo Técnico Preliminar (ETP)" : "Termo de Referência (TR)";

  const extras = form_data && typeof form_data === "object"
    ? Object.entries(form_data).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "";

  const userPrompt = `Gere um ${docTipo} completo para:

Título: ${titulo || "[A DEFINIR]"}
Órgão: ${orgao || "[ÓRGÃO]"}
Objeto da contratação: ${objeto}
${extras ? `\nDados adicionais:\n${extras}` : ""}

Gere o documento completo, com todas as seções desenvolvidas, pronto para revisão.`;

  let lastErr = "unknown";
  for (let attempt = 0; attempt < RETRY_DELAYS.length + 1; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (RETRYABLE.has(res.status) && attempt < RETRY_DELAYS.length) {
        lastErr = `Claude ${res.status}`;
        console.warn(`[generate-document] retry ${attempt + 1}: ${lastErr}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }

      if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const conteudo = data.content?.[0]?.text ?? "";
      const tituloOut = titulo || (tipo === "etp"
        ? `ETP — ${objeto.slice(0, 60)}`
        : `TR — ${objeto.slice(0, 60)}`);

      return new Response(JSON.stringify({ titulo: tituloOut, conteudo }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      lastErr = String(err);
      if (attempt >= RETRY_DELAYS.length) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }

  return new Response(JSON.stringify({ error: "Falha ao gerar documento", detail: lastErr }), {
    status: 502, headers: { ...cors, "Content-Type": "application/json" },
  });
});
