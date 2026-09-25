import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { contextoPorAssunto } from "../_shared/contexto-juridico.ts";
import { carregarIndice, conferir, conferirJurisprudencia, contem, normalizar } from "../_shared/verifica-citacoes.ts";

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

CONFERÊNCIA AUTOMÁTICA: depois de você responder, a plataforma localiza cada artigo/parágrafo/inciso citado na íntegra oficial e confere se o "textoLegal" está nele, e se o "trecho" está no documento analisado. O que não conferir é mostrado ao usuário como NÃO CONFERE. Copie os trechos exatamente.

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
 "achados": [{"item":"item/cláusula do documento", "trecho":"trecho literal entre aspas (ou vazio se for observação geral)", "categoria":"ilegalidade|risco|impugnacao|recurso|observacao", "gravidade":"alta|media|baixa", "problema":"o que está errado e por quê", "fundamento":"lei/artigo ou '[não verificado nesta sessão]'", "fonte":"ex.: Lei 14.133/2021 art. 69, § 4º", "textoLegal":"trecho LITERAL de 8 a 30 palavras do dispositivo citado, copiado da BASE JURÍDICA sem alterar nada (a plataforma confere automaticamente); vazio se o dispositivo não estiver na base", "url":"URL oficial SOMENTE se aparecer na BASE JURÍDICA; senão vazio", "acao":"o que fazer (impugnar/recorrer/sanar/ajustar/etc.)"}],
 "prazos": [{"evento":"", "dataLimite":"calculada ou 'depende de data não informada'", "baseLegal":"", "textoLegal":"trecho LITERAL do dispositivo do prazo, copiado da BASE JURÍDICA; vazio se não estiver na base", "premissa":"dias úteis/feriados"}],
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

  // O parecer leva de 2 a 4 minutos (Opus + JSON longo) e o gateway do Supabase
  // devolve 504 se a função passar 150 s sem enviar nenhum byte. Por isso a
  // resposta começa na hora e manda um espaço a cada 10 s até o JSON ficar pronto
  // (espaço antes do JSON é válido). Erro vai no corpo, como { error }.
  const gerar = async () => {
    // 1) Contexto jurídico = base indexada + jurisprudência TCU/AGU ao vivo: uma busca
    // por cláusula, em paralelo (ver contextoPorAssunto). A primeira consulta, com o
    // título e o início do documento, é a que traz a jurisprudência ao vivo.
    const clausulas = texto.split(/\n(?=\s*\d+(?:\.\d+)*[.)\s-])|\n\s*\n/)
      .map((c) => c.replace(/\s+/g, " ").trim())
      .filter((c) => c.length >= 40)
      .slice(0, 9);
    const consultas = clausulas.length ? clausulas.map((c) => c.slice(0, 600)) : [texto.slice(0, 1000)];
    const baseJuridica = await contextoPorAssunto(
      [`${body.titulo || ""} ${consultas.slice(0, 3).join(" ")}`.slice(0, 600), ...consultas], authHeader, 3);

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
      throw new Error(`Falha na IA: ${String(err).slice(0, 300)}`);
    }

    const raw = data.content?.map((c) => c.text || "").join("") || "";
    let parecer;
    try { parecer = extrairJSON(raw); }
    catch { throw new Error("Não foi possível interpretar o parecer. Tente de novo."); }

    // 3) Conferência automática (código, não IA): cada citação localizada na íntegra
    // oficial, com o textoLegal conferido dentro do dispositivo; cada trecho do
    // documento conferido no texto enviado. O resultado vai junto de cada achado.
    // deno-lint-ignore no-explicit-any
    const resumo = (cits: any[]) => cits.some((c) => c.status === "nao_confere") ? "nao_confere"
      : cits.some((c) => c.status === "conferida") ? "conferida" : cits.length ? "sem_trecho" : "sem_citacao";
    try {
      const idx = await carregarIndice(supabase);
      const docNorm = normalizar(texto);
      // deno-lint-ignore no-explicit-any
      for (const a of (parecer.achados || []) as any[]) {
        const cits = conferir(`${a.fonte || ""}: "${a.textoLegal || ""}"
${a.fundamento || ""}`, idx);
        a.verificacao = { status: resumo(cits), citacoes: cits };
        a.trechoConfere = a.trecho ? contem(docNorm, a.trecho) : null;
      }
      // deno-lint-ignore no-explicit-any
      for (const p of (parecer.prazos || []) as any[]) {
        const cits = conferir(`${p.baseLegal || ""}: "${p.textoLegal || ""}"`, idx);
        p.verificacao = { status: resumo(cits), citacoes: cits };
      }
      parecer.jurisprudenciaVerificada = conferirJurisprudencia(JSON.stringify(parecer), baseJuridica);
    } catch { /* a conferência nunca derruba o parecer */ }

    return { parecer, temBase: !!baseJuridica, geradoEm: new Date().toISOString() };
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(" "));
      const pulso = setInterval(() => controller.enqueue(enc.encode(" ")), 10000);
      try {
        controller.enqueue(enc.encode(JSON.stringify(await gerar())));
      } catch (err) {
        controller.enqueue(enc.encode(JSON.stringify({ error: String((err as Error)?.message || err) })));
      } finally {
        clearInterval(pulso);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-cache" } });
});
