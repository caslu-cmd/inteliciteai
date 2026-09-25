// Contexto jurídico para os chats: base indexada (Lei 14.133 e correlatas) +
// jurisprudência TCU/AGU ao vivo, via search-legal. Sem isto a IA responde de
// memória e erra número de artigo, apesar de a tela prometer "base indexada".

import { REGRA_TRECHO } from "./verifica-citacoes.ts";

type Msg ={ role: string; content: string };

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

// Uma busca por assunto, em paralelo: numa consulta única com vários assuntos
// misturados, a busca por semelhança se dilui e deixa de fora artigos que estão na
// base (a vistoria do Art. 63 sumia quando a consulta também falava do prazo do
// Art. 164). Trechos repetidos são descartados; a jurisprudência ao vivo vem numa
// consulta só, a primeira.
export async function contextoPorAssunto(consultas: string[], authHeader: string, porConsulta = 4): Promise<string> {
  const buscar = async (query: string, matchCount: number, includeWebSearch: boolean) => {
    try {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-legal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
        body: JSON.stringify({ query, matchCount, includeWebSearch }),
        signal: AbortSignal.timeout(60000),
      });
      return r.ok ? ((await r.json()).context || "").trim() : "";
    } catch { return ""; }
  };
  const qs = consultas.map((q) => q.trim()).filter(Boolean).slice(0, 10);
  return juntarContextos(await Promise.all(qs.map((q, i) => buscar(q.slice(0, 700), porConsulta, i === 0))));
}

export function juntarContextos(contextos: string[], limite = 24): string {
  const vistos = new Set<string>();
  const trechos: string[] = [];
  const outros: string[] = [];
  for (const ctx of contextos) {
    for (const parte of ctx.split(/\n\n---\n\n/)) {
      if (!parte.startsWith("BASE JURÍDICA INTELICITE:")) {
        if (parte.trim() && !outros.includes(parte)) outros.push(parte);   // artigos citados e jurisprudência
        continue;
      }
      for (const t of parte.replace(/^BASE JURÍDICA INTELICITE:\n/, "").split(/\n\n(?=\[\d+\])/)) {
        const corpo = t.replace(/^\[\d+\]\s*/, "").trim();
        const chave = corpo.slice(0, 200);
        if (corpo && !vistos.has(chave)) { vistos.add(chave); trechos.push(corpo); }
      }
    }
  }
  return [
    trechos.length ? `BASE JURÍDICA INTELICITE:\n${trechos.slice(0, limite).map((t, i) => `[${i + 1}] ${t}`).join("\n\n")}` : "",
    ...outros,
  ].filter(Boolean).join("\n\n---\n\n");
}

export const REGRA_FONTES = `
FONTES DESTA RESPOSTA — REGRA DURA:
- Número de artigo, inciso, parágrafo, acórdão ou súmula só pode ser citado se estiver no bloco BASE JURÍDICA abaixo. Confira o número no texto antes de citar: o dispositivo certo é o que DIZ aquilo, não o que você lembra.
- Se o ponto não estiver na base, explique o entendimento sem inventar número e escreva "(dispositivo não localizado na base; conferir)".
- Nunca atribua a um artigo um assunto diferente do que o texto dele trata.`;

export function comContexto(system: string, contexto: string): string {
  return `${system}\n${REGRA_FONTES}\n${REGRA_TRECHO}\n\nBASE JURÍDICA (trechos oficiais recuperados para esta pergunta):\n${contexto || "(nenhum trecho recuperado: não cite números de dispositivo)"}`;
}
