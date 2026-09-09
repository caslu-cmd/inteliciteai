import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

// Extrai o texto de um evento SSE. A edge function `chat` repassa o stream
// da API da Anthropic (eventos content_block_delta -> delta.text). Mantemos
// também o formato OpenAI (choices[].delta.content) por compatibilidade.
function extractDelta(parsed: unknown): string | undefined {
  const p = parsed as {
    type?: string;
    delta?: { type?: string; text?: string };
    choices?: { delta?: { content?: string } }[];
  };
  if (p?.type === "content_block_delta" && p.delta?.type === "text_delta") {
    return p.delta.text;
  }
  return p?.choices?.[0]?.delta?.content;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  messages,
  usuarioId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  usuarioId?: string;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    onError?.("Você precisa estar logado para usar o chat.");
    onDone();
    return;
  }

  // Buscar contexto de regulamentos e base jurídica para a última mensagem
  const lastUserMsg = messages.filter(m => m.role === "user").at(-1)?.content ?? "";
  let enrichedMessages = messages;
  if (lastUserMsg.trim()) {
    try {
      const { getFullContext } = await import("@/lib/orgaoUtils");
      const context = await getFullContext(lastUserMsg);
      if (context) {
        enrichedMessages = messages.map((m, i) =>
          i === messages.length - 1 && m.role === "user"
            ? { ...m, content: `${context}\n\n---\n\nPergunta: ${m.content}` }
            : m
        );
      }
    } catch { /* best-effort */ }
  }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: enrichedMessages, usuario_id: usuarioId || "" }),
  });

  if (!resp.ok) {
    let errorMsg = "Erro ao conectar com o assistente.";
    try {
      const body = await resp.json();
      if (body.error) errorMsg = body.error;
    } catch {}
    onError?.(errorMsg);
    onDone();
    return;
  }

  if (!resp.body) {
    onError?.("Sem resposta do servidor.");
    onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = extractDelta(parsed);
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = extractDelta(parsed);
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}
