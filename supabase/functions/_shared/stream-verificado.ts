import { carregarIndice, respostaSegura } from "./verifica-citacoes.ts";

// Repassa o stream SSE da Anthropic sem atraso (documentos longos: ETP/TR/DFD) e, antes
// do "message_stop", injeta o evento "intelicite_verificacao" com a conferência das
// citações e o TEXTO SANEADO: a tela troca o documento pela versão sem as citações que
// não conferem, e mostra a conferência num painel fora do documento.
// deno-lint-ignore no-explicit-any
export function streamVerificado(corpo: ReadableStream<Uint8Array>, supabase: any, contexto: string) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let resto = "";
  let texto = "";
  let injetado = false;

  const injetar = async (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (injetado) return;
    injetado = true;
    let ev: Record<string, unknown>;
    try {
      const r = await respostaSegura(texto, await carregarIndice(supabase), contexto, undefined, supabase);
      ev = { type: "intelicite_verificacao", markdown: r.rodape.replace(/^\s*---\s*/, ""), citacoes: r.citacoes, normas: r.normas,
             jurisprudencia: r.jurisprudencia, ...(r.texto !== texto ? { texto: r.texto } : {}) };
    } catch {
      ev = { type: "intelicite_verificacao", markdown: "⚠️ **A conferência automática ficou indisponível neste documento.** Confira cada artigo, lei e acórdão no texto oficial antes de usar.", citacoes: [{ status: "nao_confere" }] };
    }
    controller.enqueue(enc.encode(`event: intelicite_verificacao\ndata: ${JSON.stringify(ev)}\n\n`));
  };

  return corpo.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      resto += dec.decode(chunk, { stream: true });
      const linhas = resto.split("\n");
      resto = linhas.pop()!;
      for (const l of linhas) {
        if (l.startsWith("data: ")) {
          try {
            const j = JSON.parse(l.slice(6));
            if (j.type === "content_block_delta" && j.delta?.type === "text_delta") texto += j.delta.text;
            if (j.type === "message_stop") await injetar(controller);
          } catch { /* linha parcial ou não-JSON: só repassa */ }
        }
        controller.enqueue(enc.encode(l + "\n"));
      }
    },
    async flush(controller) {
      if (resto) controller.enqueue(enc.encode(resto));
      await injetar(controller);
    },
  }));
}
