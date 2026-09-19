import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const IBGE_CNAE_API = "https://servicodados.ibge.gov.br/api/v2/cnae/subclasses";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item { id: string; title: string; organ?: string }
interface Score { id: string; match: number; motivo: string }

// Resposta sempre 200 com { scores, error? }: o front mostra `error` ao usuário.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Aceita "4751-2/01", "4751201", "4751.2/01"… → 7 dígitos (subclasse CNAE).
const CNAE_RE = /\b(\d{4})[-.\s]?(\d)[\/\s]?(\d{2})\b/g;

function extrairCnaes(texto: string): string[] {
  const codigos = new Set<string>();
  for (const m of texto.matchAll(CNAE_RE)) codigos.add(`${m[1]}${m[2]}${m[3]}`);
  return [...codigos].slice(0, 5);
}

function formatarCnae(c: string) {
  return `${c.slice(0, 4)}-${c.slice(4, 5)}/${c.slice(5, 7)}`;
}

// Traduz o código para a atividade econômica (IBGE). Falha silenciosa: o
// modelo ainda recebe o código e é instruído a interpretá-lo.
async function descreverCnae(codigo: string): Promise<string | null> {
  try {
    const res = await fetch(`${IBGE_CNAE_API}/${codigo}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = await res.json();
    const partes = [j?.descricao, j?.classe?.descricao, j?.classe?.grupo?.descricao]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim());
    const unicas = [...new Set(partes)];
    return unicas.length ? `CNAE ${formatarCnae(codigo)}: ${unicas.join(" · ")}` : null;
  } catch {
    return null;
  }
}

// Saída estruturada: a API garante JSON válido neste formato.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "match", "motivo"],
        properties: {
          id: { type: "string", description: "id da licitação, exatamente como recebido" },
          match: { type: "integer", description: "0 a 100" },
          motivo: { type: "string", description: "justificativa curta, máx. 12 palavras" },
        },
      },
    },
  },
};

const SYSTEM =
  `Você avalia o "match" (aderência comercial) entre o que uma empresa fornece e licitações públicas brasileiras.\n` +
  `Para CADA licitação recebida, devolva um item em "scores" com o MESMO id recebido, ` +
  `"match" de 0 a 100 (0 = nada a ver, 100 = encaixe perfeito) e "motivo" curto (máx. 12 palavras), em português.\n` +
  `Se o perfil trouxer códigos CNAE, interprete-os pela Classificação Nacional de Atividades Econômicas (IBGE) ` +
  `e use as descrições de atividade fornecidas. Considere o objeto da licitação e o órgão. Não omita nenhuma licitação.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ scores: [], error: "IA não configurada" });

  let body: { perfil?: string; itens?: Item[] };
  try { body = await req.json(); } catch {
    return json({ scores: [], error: "JSON inválido" });
  }

  const perfil = (body.perfil || "").trim();
  const itens = Array.isArray(body.itens) ? body.itens.slice(0, 30) : [];
  if (!perfil || itens.length === 0) return json({ scores: [] });

  // Enriquecimento do perfil com as atividades dos CNAEs informados.
  const cnaes = extrairCnaes(perfil);
  const atividades = (await Promise.all(cnaes.map(descreverCnae))).filter((d): d is string => !!d);
  console.log(`match: user=${user.id} itens=${itens.length} perfil=${perfil.length}c cnaes=${cnaes.length} descritos=${atividades.length}`);

  const lista = itens.map((it) => ({ id: String(it.id), objeto: it.title, orgao: it.organ || "" }));
  const prompt =
    `PERFIL DA EMPRESA (o que ela fornece / atua):\n"${perfil}"\n` +
    (atividades.length ? `\nATIVIDADES ECONÔMICAS (CNAE, conforme IBGE):\n${atividades.map((a) => `- ${a}`).join("\n")}\n` : "") +
    `\nLICITAÇÕES (${lista.length}):\n${JSON.stringify(lista)}`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => "");
      console.error(`match: anthropic ${res.status} ${detalhe.slice(0, 500)}`);
      return json({ scores: [], error: `IA indisponível (${res.status}). Tente novamente em instantes.` });
    }

    const data = await res.json();
    console.log(`match: stop=${data.stop_reason} in=${data.usage?.input_tokens} out=${data.usage?.output_tokens}`);

    if (data.stop_reason === "max_tokens") {
      return json({ scores: [], error: "Resposta da IA incompleta. Tente com menos oportunidades (use os filtros)." });
    }
    if (data.stop_reason === "refusal") {
      return json({ scores: [], error: "A IA não conseguiu avaliar este perfil. Descreva a empresa com outras palavras." });
    }

    const text: string = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();

    let scores: Score[] = [];
    try {
      const parsed = JSON.parse(text) as { scores?: Score[] };
      const validos = new Set(lista.map((l) => l.id));
      scores = (parsed.scores || [])
        .filter((s) => validos.has(String(s.id)))
        .map((s) => ({
          id: String(s.id),
          match: Math.max(0, Math.min(100, Math.round(Number(s.match) || 0))),
          motivo: String(s.motivo || "").slice(0, 140),
        }));
    } catch (e) {
      console.error(`match: parse falhou: ${(e as Error).message} :: ${text.slice(0, 300)}`);
      return json({ scores: [], error: "Falha ao interpretar a resposta da IA. Tente novamente." });
    }

    if (scores.length === 0) {
      console.error(`match: 0 scores válidos :: ${text.slice(0, 300)}`);
      return json({ scores: [], error: "A IA não retornou notas para estas oportunidades. Tente novamente." });
    }

    return json({ scores, cnaes: atividades });
  } catch (err) {
    console.error(`match: erro ${(err as Error).message}`);
    return json({ scores: [], error: "Erro ao consultar a IA. Tente novamente." });
  }
});
