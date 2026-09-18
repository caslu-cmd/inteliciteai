import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Visão Geral em Áudio: gera um roteiro de podcast a partir das fontes ativas
// do notebook, sintetiza cada fala na ElevenLabs e grava os MP3 no bucket
// privado `notebook-audio`. O resultado fica persistido em
// notebook_audio_overviews (um por notebook; regenerar substitui o anterior).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VOICE_ANA    = "21m00Tcm4TlvDq8ikWAM"; // Rachel — female, multilingual
const VOICE_CARLOS = "ErXwobaYiN019PkySvjV"; // Antoni — male, multilingual
const ELEVEN_MODEL = "eleven_multilingual_v2";
const BUCKET = "notebook-audio";
const MAX_CHARS_PER_SOURCE = 6000;
const MAX_CHARS_TOTAL = 40000;

interface Source { title: string; content: string }
interface Segment { speaker: "A" | "B"; text: string }
interface StoredSegment extends Segment { path: string }

async function generateScript(sources: Source[], apiKey: string): Promise<string> {
  let budget = MAX_CHARS_TOTAL;
  const docs = sources
    .map((s, i) => {
      const slice = s.content.slice(0, Math.min(MAX_CHARS_PER_SOURCE, Math.max(0, budget)));
      budget -= slice.length;
      return `[Fonte ${i + 1}: ${s.title}]\n${slice}`;
    })
    .filter((d) => d.length > 0)
    .join("\n\n---\n\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: `Você é roteirista de podcast sobre licitações públicas no Brasil. Com base nos documentos abaixo, crie um roteiro de podcast de 3-5 minutos com DOIS apresentadores:
- ANA: especialista jurídica, tom didático e analítico
- CARLOS: consultor prático de licitações, tom direto e objetivo

Formato EXATO (use SOMENTE estas marcações, sem outra formatação):
[ANA]: texto da fala de Ana
[CARLOS]: texto da fala de Carlos

Regras:
- Linguagem natural e conversacional, como um podcast real
- Cubra os pontos mais importantes dos documentos
- Cite a Lei 14.133/2021 quando pertinente
- Mínimo 10 trocas de fala, máximo 15
- Cada fala: 50-180 palavras
- Comece direto com a fala, sem introdução longa
- Em português do Brasil

DOCUMENTOS:
${docs}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Falha ao gerar roteiro (${res.status})`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseScript(script: string): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const line of script.split("\n")) {
    const ana    = line.match(/^\[ANA\]:\s*(.+)/i);
    const carlos = line.match(/^\[CARLOS\]:\s*(.+)/i);

    if (ana) {
      if (current) segments.push(current);
      current = { speaker: "A", text: ana[1].trim() };
    } else if (carlos) {
      if (current) segments.push(current);
      current = { speaker: "B", text: carlos[1].trim() };
    } else if (current && line.trim()) {
      current.text += " " + line.trim();
    }
  }
  if (current) segments.push(current);
  return segments.filter((s) => s.text.length > 5);
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function tts(text: string, voiceId: string, elevenKey: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.82 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return json({ error: "Token inválido" }, 401);

  let body: { notebookId?: string; sources?: Source[] } = {};
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const notebookId = body.notebookId || "";

  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  const ELEVEN_KEY  = Deno.env.get("ELEVENLABS_API_KEY");
  if (!LOVABLE_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 503);
  if (!ELEVEN_KEY)  return json({ error: "ELEVENLABS_API_KEY não configurada" }, 503);

  // Modo legado: frontend anterior à Fase 1 envia as fontes no corpo e espera
  // o MP3 em base64, sem persistência. Mantido até o novo front ir ao ar.
  if (!notebookId) {
    const legacy = (Array.isArray(body.sources) ? body.sources : [])
      .filter((s) => s && typeof s.content === "string" && s.content.trim())
      .map((s) => ({ title: String(s.title || "Fonte"), content: s.content }));
    if (!legacy.length) return json({ error: "notebookId obrigatório (ou sources)" }, 400);
    try {
      const script   = await generateScript(legacy, LOVABLE_KEY);
      const segments = parseScript(script);
      if (!segments.length) throw new Error("Roteiro vazio — tente novamente");
      const out: (Segment & { audio: string })[] = [];
      for (const seg of segments) {
        const bytes = await tts(seg.text, seg.speaker === "A" ? VOICE_ANA : VOICE_CARLOS, ELEVEN_KEY);
        out.push({ ...seg, audio: toBase64(bytes) });
      }
      return json({ segments: out, script });
    } catch (err) {
      console.error("audio-overview (legado):", (err as Error).message);
      return json({ error: (err as Error).message }, 500);
    }
  }

  // O notebook precisa ser do usuário; as fontes vêm do banco
  const { data: notebook } = await supabase
    .from("notebooks").select("id").eq("id", notebookId).eq("user_id", user.id).maybeSingle();
  if (!notebook) return json({ error: "Notebook não encontrado" }, 404);

  const { data: sources } = await supabase
    .from("notebook_sources")
    .select("title, content")
    .eq("notebook_id", notebookId)
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (!sources?.length) return json({ error: "Ative pelo menos uma fonte" }, 400);

  try {
    const script   = await generateScript(sources as Source[], LOVABLE_KEY);
    const segments = parseScript(script);
    if (!segments.length) throw new Error("Roteiro vazio — tente novamente");

    const overviewId = crypto.randomUUID();
    const stored: StoredSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const bytes = await tts(seg.text, seg.speaker === "A" ? VOICE_ANA : VOICE_CARLOS, ELEVEN_KEY);
      const path = `${user.id}/${notebookId}/${overviewId}/${String(i).padStart(2, "0")}.mp3`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`Falha ao salvar áudio: ${upErr.message}`);
      stored.push({ ...seg, path });
    }

    // Substitui a visão geral anterior deste notebook (linha + arquivos)
    const { data: previous } = await supabase
      .from("notebook_audio_overviews").select("id, segments").eq("notebook_id", notebookId).maybeSingle();
    if (previous) {
      const oldPaths = ((previous.segments as StoredSegment[]) || []).map((s) => s.path).filter(Boolean);
      if (oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths);
      await supabase.from("notebook_audio_overviews").delete().eq("id", previous.id);
    }

    const { data: row, error: insErr } = await supabase
      .from("notebook_audio_overviews")
      .insert({ id: overviewId, notebook_id: notebookId, user_id: user.id, script, segments: stored })
      .select("id, created_at")
      .single();
    if (insErr) throw new Error(`Falha ao registrar áudio: ${insErr.message}`);

    return json({ id: row.id, createdAt: row.created_at, script, segments: stored });
  } catch (err) {
    console.error("audio-overview:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
