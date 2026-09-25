// Resposta JSON com keepalive: o gateway do Supabase corta em 150 s sem nenhum byte, e a
// conferência (Planalto + revisão de pertinência + reescrita) pode passar disso. Manda um
// espaço a cada 10 s e, no fim, o JSON; espaço antes do JSON não atrapalha o res.json().
// Como o status já saiu 200, erro vai como { error } no corpo (o frontend checa json.error).
export function jsonComPulso(trabalho: () => Promise<unknown>, headers: Record<string, string>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(" "));
      const pulso = setInterval(() => controller.enqueue(enc.encode(" ")), 10000);
      try {
        controller.enqueue(enc.encode(JSON.stringify(await trabalho())));
      } catch (err) {
        controller.enqueue(enc.encode(JSON.stringify({ error: (err as Error).message || "Falha", detail: String(err) })));
      } finally {
        clearInterval(pulso);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/json" } });
}
