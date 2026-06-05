import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_ANA    = "21m00Tcm4TlvDq8ikWAM"; // Rachel — female, multilingual
const VOICE_CARLOS = "ErXwobaYiN019PkySvjV"; // Antoni — male, multilingual
const ELEVEN_MODEL = "eleven_multilingual_v2";

interface Source { title: string; content: string }
interface Segment { speaker: "A" | "B"; text: string }
interface AudioSegment extends Segment { audio: string }

async function generateScript(sources: Source[], apiKey: string): Promise<string> {
  const docs = sources
    .map((s, i) => `[Fonte ${i + 1}: ${s.title}]\n${s.content.slice(0, 3000)}`)
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

async function tts(text: string, voiceId: string, elevenKey: string): Promise<string> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.82 },
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${msg}`);
  }

  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sources } = (await req.json()) as { sources: Source[] };

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ELEVEN_KEY  = Deno.env.get("ELEVENLABS_API_KEY");
    if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!ELEVEN_KEY)  throw new Error("ELEVENLABS_API_KEY não configurada");

    const script   = await generateScript(sources, LOVABLE_KEY);
    const segments = parseScript(script);
    if (!segments.length) throw new Error("Script vazio — tente novamente");

    const audioSegments: AudioSegment[] = [];
    for (const seg of segments) {
      const voiceId = seg.speaker === "A" ? VOICE_ANA : VOICE_CARLOS;
      const audio   = await tts(seg.text, voiceId, ELEVEN_KEY);
      audioSegments.push({ ...seg, audio });
    }

    return new Response(JSON.stringify({ segments: audioSegments, script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
