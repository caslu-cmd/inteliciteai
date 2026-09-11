import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item { id: string; title: string; organ?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "IA não configurada" }), { status: 503, headers: cors });

  let body: { perfil?: string; itens?: Item[] };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  const perfil = (body.perfil || "").trim();
  const itens = Array.isArray(body.itens) ? body.itens.slice(0, 30) : [];
  if (!perfil || itens.length === 0) {
    return new Response(JSON.stringify({ scores: [] }), { headers: cors });
  }

  const lista = itens.map((it) => ({ id: it.id, objeto: it.title, orgao: it.organ || "" }));

  const prompt =
    `Você avalia o "match" (aderência comercial) entre o que a empresa fornece e cada licitação pública.\n\n` +
    `PERFIL DA EMPRESA (o que ela fornece / atua):\n"${perfil}"\n\n` +
    `Para CADA licitação abaixo, dê:\n` +
    `- "match": nota de 0 a 100 (quão aderente é ao perfil da empresa; 0 = nada a ver, 100 = encaixe perfeito)\n` +
    `- "motivo": justificativa curta (máx. 12 palavras)\n\n` +
    `Responda APENAS um array JSON válido, sem texto fora dele, no formato:\n` +
    `[{"id":"<id>","match":<0-100>,"motivo":"<texto>"}]\n\n` +
    `LICITAÇÕES:\n${JSON.stringify(lista)}`;

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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `IA ${res.status}` }), { status: 502, headers: cors });
    }
    const data = await res.json();
    let text: string = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();

    // Extrai o array JSON mesmo se vier cercado por texto/cercas de código.
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    let scores: { id: string; match: number; motivo: string }[] = [];
    try {
      // deno-lint-ignore no-explicit-any
      scores = (JSON.parse(text) as any[]).map((s) => ({
        id: String(s.id),
        match: Math.max(0, Math.min(100, Math.round(Number(s.match) || 0))),
        motivo: String(s.motivo || "").slice(0, 140),
      }));
    } catch {
      return new Response(JSON.stringify({ scores: [], error: "Falha ao interpretar a resposta da IA" }), { headers: cors });
    }

    return new Response(JSON.stringify({ scores }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
