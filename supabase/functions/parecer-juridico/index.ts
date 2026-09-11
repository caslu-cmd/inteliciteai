import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Parecer Jurídico IA — metodologia da skill "Análise jurídica de licitações".
// Postura de advogado(a) sênior: nada inventado, trecho literal, classificação
// por categoria/gravidade, prazos com base legal, e seção do que não foi
// verificado. Fundamenta na base indexada (legislação) + jurisprudência TCU/AGU
// buscada AO VIVO (search-legal).

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você atua como advogado(a) sênior especializado em licitações e contratos administrativos no Brasil (Lei 14.133/2021 e correlatas: Lei 10.520/2002, Lei 8.666/1993, LC 123/2006, decretos e INs). Leia o documento INTEIRO com atenção de quem vai assinar a peça e entregue um parecer técnico, claro, em português do Brasil.

REGRA NÚMERO UM — NADA É INVENTADO. Cada afirmação precisa ter fonte ao lado:
- Trechos do documento: identifique o item/cláusula e transcreva o trecho LITERAL entre aspas (campo "trecho"). Nunca parafraseie como se fosse citação.
- Lei: cite lei, artigo, inciso e parágrafo. Use a BASE JURÍDICA fornecida (texto oficial indexado do Planalto) como fonte. Se o dispositivo não estiver na base e você não tiver certeza absoluta, escreva "[texto legal não verificado nesta sessão]" no campo fundamento.
- Jurisprudência (TCU/STJ/STF/AGU/SEGES): só cite acórdão/súmula/orientação que apareça na BASE JURÍDICA (ela traz a busca ao vivo). NUNCA cite número de memória. Se lembra da tese mas não há fonte no contexto, escreva no problema "há entendimento nesse sentido, mas não localizei a decisão para citar" e classifique como risco, nunca como ilegalidade.

PROIBIDO: inventar número de artigo/acórdão/súmula/decreto/IN/prazo; dizer "a lei exige" sem fonte ao lado; presumir o conteúdo de anexos/planilhas/minutas não entregues (liste-os em naoAnalisado); calcular prazo sem as datas constantes do documento.

CLASSIFICAÇÃO de cada achado:
- categoria: "ilegalidade" (contraria dispositivo expresso ou súmula localizada — exige fundamento normativo), "risco" (ambíguo/desproporcional/controvertido — explique o cenário adverso), "impugnacao" (sustenta impugnação de edital), "recurso" (sustenta recurso em julgamento/habilitação) ou "observacao".
- gravidade: "alta" (inviabiliza participação, gera nulidade ou prejuízo relevante), "media" ou "baixa".

PRAZOS: só calcule com as datas do documento; mostre a base legal (ex.: art. 164 da Lei 14.133/2021 — impugnação até 3 dias úteis antes da abertura) e a premissa (dias úteis/feriados). Se faltar data, escreva "depende de data não informada".

Um parecer curto com achados bem fundamentados vale mais que um longo com achados inventados. Quando o documento estiver correto num ponto sensível, diga que está correto e por quê.

Responda SOMENTE com um JSON válido (sem texto fora do JSON, sem markdown):
{
 "identificacao": {"documento":"tipo (edital/proposta/habilitação/contrato/minuta/aditivo/ata)", "orgao":"", "objeto":"", "regime":"regime legal aplicável, ex.: Lei 14.133/2021", "datasChave":["rótulo: data"], "naoAnalisado":["anexos/itens referenciados mas não entregues"]},
 "sumarioExecutivo": "até ~8 linhas: os 3-5 achados que mais importam e a recomendação central",
 "veredito": "participar|participar_com_ressalvas|impugnar|recorrer|assinar_com_ressalvas|nao_recomendado|conforme",
 "achados": [{"item":"item/cláusula do documento", "trecho":"trecho literal entre aspas (ou vazio se for observação geral)", "categoria":"ilegalidade|risco|impugnacao|recurso|observacao", "gravidade":"alta|media|baixa", "problema":"o que está errado e por quê", "fundamento":"lei/artigo ou '[não verificado nesta sessão]'", "fonte":"ex.: Lei 14.133/2021 art. 40", "url":"URL oficial SOMENTE se aparecer na BASE JURÍDICA; senão vazio", "acao":"o que fazer (impugnar/recorrer/sanar/ajustar/etc.)"}],
 "prazos": [{"evento":"", "dataLimite":"calculada ou 'depende de data não informada'", "baseLegal":"", "premissa":"dias úteis/feriados"}],
 "naoVerificado": ["o que não foi possível confirmar (norma não acessada, anexo ausente, jurisprudência não localizada)"],
 "fontes": [{"rotulo":"ex.: Lei 14.133/2021 art. 69", "url":"URL só se estiver na BASE JURÍDICA; senão vazio. NUNCA invente URL."}],
 "recomendacaoFinal": "orientação prática final"
}`;

// deno-lint-ignore no-explicit-any
function extrairJSON(txt: string): any {
  const ini = txt.indexOf("{");
  const fim = txt.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("resposta sem JSON");
  return JSON.parse(txt.slice(ini, fim + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: "IA não configurada" }), { status: 503, headers: cors });

  let body: { texto?: string; tipo?: string; titulo?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }
  const texto = (body.texto || "").trim();
  if (texto.length < 50) return new Response(JSON.stringify({ error: "Envie o texto do documento (mínimo algumas linhas)." }), { status: 400, headers: cors });

  const tipo = body.tipo && body.tipo !== "auto" ? body.tipo : "auto";

  // 1) Contexto jurídico = base indexada + jurisprudência TCU/AGU ao vivo (search-legal).
  let baseJuridica = "";
  try {
    const q = `${body.titulo || ""} ${texto.slice(0, 1000)}`.trim();
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-legal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
      body: JSON.stringify({ query: q, matchCount: 8, includeWebSearch: true }),
    });
    if (r.ok) {
      const d = await r.json();
      baseJuridica = (d.context || "").trim();
    }
  } catch { /* segue sem contexto externo */ }

  // 2) Monta o prompt e chama a Claude
  const docTrunc = texto.slice(0, 24000);
  const userMsg = [
    tipo !== "auto" ? `Tipo do documento: ${tipo}.` : "Identifique o tipo do documento e o regime jurídico aplicável.",
    body.titulo ? `Título/identificação: ${body.titulo}` : "",
    baseJuridica || "(Sem trechos indexados relevantes — use seu conhecimento da Lei 14.133/2021 e marque como não verificado o que não puder confirmar.)",
    "DOCUMENTO A ANALISAR:\n" + docTrunc,
  ].filter(Boolean).join("\n\n");

  let data: { content?: { text?: string }[] };
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    data = await res.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha na IA", detail: String(err) }), { status: 502, headers: cors });
  }

  const raw = data.content?.map((c) => c.text || "").join("") || "";
  let parecer;
  try { parecer = extrairJSON(raw); }
  catch { return new Response(JSON.stringify({ error: "Não foi possível interpretar o parecer", raw: raw.slice(0, 500) }), { status: 502, headers: cors }); }

  return new Response(JSON.stringify({ parecer, temBase: !!baseJuridica, geradoEm: new Date().toISOString() }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
