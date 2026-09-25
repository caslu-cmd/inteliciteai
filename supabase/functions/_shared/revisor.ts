// Revisor de pertinência: o código já garante que o dispositivo citado EXISTE e que o
// trecho transcrito é daquele artigo; falta saber se o texto oficial SUSTENTA a afirmação
// que a IA fez com ele (ex.: citar uma IN real para um prazo que ela não trata). Uma
// segunda chamada, só de revisão, compara cada afirmação com o texto oficial do dispositivo.

const API = "https://api.anthropic.com/v1/messages";
const MODELO = "claude-opus-5";

export type Veredito = "sustenta" | "parcial" | "nao_sustenta";
export interface ItemRevisao { id: string; citacao: string; afirmacao: string; textoOficial: string }
export interface Revisao { id: string; veredito: Veredito; motivo: string }

const SCHEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          veredito: { type: "string", enum: ["sustenta", "parcial", "nao_sustenta"] },
          motivo: { type: "string" },
        },
        required: ["id", "veredito", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["itens"],
  additionalProperties: false,
};

const SYSTEM = `Você revisa citações jurídicas de uma plataforma de licitações (Lei 14.133/2021 e correlatas).
Para cada item você recebe: a AFIRMAÇÃO feita na resposta, a CITAÇÃO usada como fundamento e o TEXTO OFICIAL desse dispositivo.
Decida somente com base no TEXTO OFICIAL fornecido, sem usar conhecimento externo:
- "sustenta": o texto oficial fundamenta a afirmação, tal como foi feita.
- "parcial": fundamenta parte da afirmação; outra parte (prazo, número, exceção, alcance) não está no texto.
- "nao_sustenta": o texto oficial trata de outro assunto ou contradiz a afirmação.
Em "motivo", uma frase curta e objetiva em português dizendo o que falta ou diverge. Seja rigoroso: na dúvida entre "sustenta" e "parcial", escolha "parcial".`;

// Devolve null quando a revisão não pôde ser feita (sem chave, erro, recusa): quem chama
// trata como "não revisado", nunca como aprovado.
export async function revisarPertinencia(itens: ItemRevisao[], ms = 90000): Promise<Revisao[] | null> {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave || !itens.length) return itens.length ? null : [];
  const conteudo = itens.map((i) =>
    `ITEM ${i.id}\nCITAÇÃO: ${i.citacao}\nAFIRMAÇÃO: ${i.afirmacao}\nTEXTO OFICIAL: ${i.textoOficial}`).join("\n\n---\n\n");
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        // recusa por filtro de segurança: o servidor passa a outro modelo na mesma chamada
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 16000,
        fallbacks: "default",
        system: SYSTEM,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: conteudo }],
      }),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.stop_reason === "refusal" || d.stop_reason === "max_tokens") return null;
    const txt = (d.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const itensOut = JSON.parse(txt).itens as Revisao[];
    return Array.isArray(itensOut) ? itensOut : null;
  } catch {
    return null;
  }
}
