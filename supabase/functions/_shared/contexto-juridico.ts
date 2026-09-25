// Contexto jurídico para os chats: base indexada (Lei 14.133 e correlatas) +
// jurisprudência TCU/AGU ao vivo, via search-legal. Sem isto a IA responde de
// memória e erra número de artigo, apesar de a tela prometer "base indexada".

type Msg = { role: string; content: string };

export async function contextoJuridico(messages: Msg[], authHeader: string): Promise<string> {
  // As duas últimas perguntas do usuário: cobre a pergunta de seguimento ("e se for ME?").
  const query = messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join("\n").slice(0, 2000);
  if (!query.trim()) return "";
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-legal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ query, matchCount: 8, includeWebSearch: true }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return "";
    return ((await r.json()).context || "").trim();
  } catch {
    return "";
  }
}

export const REGRA_FONTES = `
FONTES DESTA RESPOSTA — REGRA DURA:
- Número de artigo, inciso, parágrafo, acórdão ou súmula só pode ser citado se estiver no bloco BASE JURÍDICA abaixo. Confira o número no texto antes de citar: o dispositivo certo é o que DIZ aquilo, não o que você lembra.
- Se o ponto não estiver na base, explique o entendimento sem inventar número e escreva "(dispositivo não localizado na base; conferir)".
- Nunca atribua a um artigo um assunto diferente do que o texto dele trata.`;

export function comContexto(system: string, contexto: string): string {
  return `${system}\n${REGRA_FONTES}\n\nBASE JURÍDICA (trechos oficiais recuperados para esta pergunta):\n${contexto || "(nenhum trecho recuperado: não cite números de dispositivo)"}`;
}
