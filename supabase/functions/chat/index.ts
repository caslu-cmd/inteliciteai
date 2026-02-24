import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, usuario_id } = await req.json();
    const GPT_MAKER_WEBHOOK_URL = Deno.env.get("GPT_MAKER_WEBHOOK_URL");
    if (!GPT_MAKER_WEBHOOK_URL) throw new Error("GPT_MAKER_WEBHOOK_URL is not configured");

    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    if (!lastUserMessage) throw new Error("No user message found");

    const response = await fetch(GPT_MAKER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: lastUserMessage.content,
        usuario_id: usuario_id || "",
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("GPT Maker webhook error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço do GPT Maker" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GPT Maker pode retornar texto puro ou JSON
    const contentType = response.headers.get("content-type") || "";
    let reply: string;

    if (contentType.includes("application/json")) {
      const data = await response.json();
      // Tenta extrair a resposta de campos comuns
      reply = data.response || data.message || data.reply || data.output || data.text || JSON.stringify(data);
    } else {
      reply = await response.text();
    }

    // Retorna como SSE para manter compatibilidade com o frontend
    const ssePayload = `data: ${JSON.stringify({
      choices: [{ delta: { content: reply } }],
    })}\n\ndata: [DONE]\n\n`;

    return new Response(ssePayload, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
