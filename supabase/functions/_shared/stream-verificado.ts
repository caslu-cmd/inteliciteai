import { carregarIndice, conferir, conferirJurisprudencia, rodapeVerificacao } from "./verifica-citacoes.ts";

// Repassa o stream SSE da Anthropic sem atraso e, antes do "message_stop", injeta
// a conferência automática das citações:
// - modo "texto": como mais um content_block_delta (vira rodapé da mensagem do chat);
// - modo "evento": como evento próprio "intelicite_verificacao" (os geradores de
//   documento mostram num painel, fora do texto do ETP/TR/DFD).
// deno-lint-ignore no-explicit-any
export function streamVerificado(corpo: ReadableStream<Uint8Array>, supabase: any, contexto: string, modo: "texto" | "evento") {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let resto = "";
  let texto = "";
  let injetado = false;

  const injetar = async (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (injetado) return;
    injetado = true;
    try {
      const idx = await carregarIndice(supabase);
      const cits = conferir(texto, idx);
      const juris = conferirJurisprudencia(texto, contexto);
      const md = rodapeVerificacao(cits, juris);
      if (!md) return;
      const ev = modo === "texto"
        ? { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "\n" + md } }
        : { type: "intelicite_verificacao", markdown: md.replace(/^\s*---\s*/, ""), citacoes: cits, jurisprudencia: juris };
      controller.enqueue(enc.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
    } catch { /* a conferência nunca derruba a resposta */ }
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
