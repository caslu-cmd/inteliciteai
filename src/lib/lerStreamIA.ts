// Lê o stream SSE dos geradores (ETP/TR/DFD). Guarda o pedaço de linha que chega
// partido entre dois blocos de rede: sem isso, trechos do documento e o evento
// final da conferência de citações se perdiam.
export interface VerificacaoIA {
  markdown: string;
  citacoes?: { rotulo: string; status: "conferida" | "sem_trecho" | "nao_confere"; motivo: string }[];
}

export async function lerStreamIA(
  res: Response,
  { onTexto, onVerificacao }: { onTexto: (acumulado: string) => void; onVerificacao?: (v: VerificacaoIA) => void },
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let resto = "";
  let acc = "";
  const linha = (l: string) => {
    if (!l.startsWith("data: ")) return;
    try {
      const j = JSON.parse(l.slice(6));
      if (j.type === "content_block_delta" && j.delta?.text) { acc += j.delta.text; onTexto(acc); }
      if (j.type === "intelicite_verificacao" && j.markdown) onVerificacao?.(j);
    } catch { /* linha não-JSON */ }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    linhas.forEach((l) => linha(l.replace(/\r$/, "")));
  }
  if (resto) linha(resto);
  return acc;
}
