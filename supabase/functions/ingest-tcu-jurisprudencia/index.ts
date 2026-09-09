import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Endpoint oficial de dados abertos do TCU (acórdãos).
const TCU_API = "https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos";

// Só ingerimos acórdãos ligados a licitações/contratos (foco do Intelicite).
const TERMOS_LICITACAO = [
  "licita", "contrato", "contrata", "pregão", "pregao", "dispensa", "inexigibilidade",
  "edital", "14.133", "14133", "8.666", "8666", "sobrepreço", "sobrepreco",
  "aditivo", "habilita", "credenciamento", "concorrência", "concorrencia", "srp",
  "registro de preços", "registro de precos",
];

function ehLicitacao(texto: string): boolean {
  const t = texto.toLowerCase();
  return TERMOS_LICITACAO.some((termo) => t.includes(termo));
}

function chunkText(text: string, size = 800, overlap = 120): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end));
      if (boundary > start + size - 200) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content.length > 30) chunks.push(content);
    start = end - overlap;
    if (start >= end) start = end;
  }
  return chunks;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Autenticação: (1) segredo de cron OU (2) usuário admin (disparo manual).
  const cronSecret = req.headers.get("x-cron-secret");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  let autorizado = false;

  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    autorizado = true;
  } else {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single();
        if (profile?.platform_role === "admin") autorizado = true;
      }
    }
  }
  if (!autorizado) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), { status: 503, headers: cors });

  let body: { inicio?: number; quantidade?: number } = {};
  try { body = await req.json(); } catch { /* usa defaults */ }
  const inicio = body.inicio ?? 0;
  const quantidade = Math.min(body.quantidade ?? 100, 200);

  try {
    // 1) Busca lote de acórdãos no TCU
    const res = await fetch(`${TCU_API}?inicio=${inicio}&quantidade=${quantidade}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `TCU ${res.status}`, detail: (await res.text()).slice(0, 300) }), { status: 502, headers: cors });
    }
    const payload = await res.json();
    // deno-lint-ignore no-explicit-any
    const itens: any[] = Array.isArray(payload) ? payload : (payload?.data ?? payload?.acordaos ?? []);
    if (!Array.isArray(itens) || itens.length === 0) {
      return new Response(JSON.stringify({ ok: true, recebidos: 0, inseridos: 0, motivo: "resposta vazia ou formato inesperado" }), { headers: cors });
    }

    // 2) Referências já existentes (dedup) — uma consulta só
    const { data: existentes } = await supabase
      .from("legal_knowledge")
      .select("reference")
      .eq("source_type", "acordao_tcu");
    const jaExiste = new Set((existentes ?? []).map((r: { reference: string }) => (r.reference || "").trim()));

    let inseridos = 0, pulados = 0, foraDoTema = 0;

    for (const it of itens) {
      const numero    = it.numeroAcordao ?? it.numero ?? "";
      const ano       = it.anoAcordao ?? it.ano ?? null;
      const colegiado = it.colegiado ?? it.tipo ?? "";
      const titulo    = (it.titulo ?? "").toString().trim();
      const sumario   = (it.sumario ?? it.enunciado ?? "").toString().trim();
      const relator   = it.relator ?? "";
      const dataSessao = it.dataSessao ?? "";

      const reference = `Acórdão ${numero}/${ano}${colegiado ? ` - ${colegiado}` : ""}`.trim();
      const corpo = `${titulo}\n\n${sumario}`.trim();

      if (!numero || !ano || corpo.length < 40) { pulados++; continue; }
      if (jaExiste.has(reference.trim())) { pulados++; continue; }
      if (!ehLicitacao(`${titulo} ${sumario}`)) { foraDoTema++; continue; }

      const content =
        `${reference}\n` +
        (relator ? `Relator: ${relator}\n` : "") +
        (dataSessao ? `Sessão: ${dataSessao}\n` : "") +
        `\n${corpo}`;

      // 3) Insere na base jurídica
      const { data: inserted, error: insErr } = await supabase
        .from("legal_knowledge")
        .insert({
          title: titulo || reference,
          source_type: "acordao_tcu",
          reference,
          year: Number(ano) || null,
          content,
          active: true,
        })
        .select("id")
        .single();
      if (insErr || !inserted) { pulados++; continue; }

      // 4) Chunk + embeddings
      const chunks = chunkText(content);
      if (chunks.length > 0) {
        const embeddings = await embedBatch(chunks, OPENAI_KEY);
        const rows = chunks.map((c, j) => ({
          knowledge_id: inserted.id,
          chunk_index:  j,
          content:      c,
          embedding:    JSON.stringify(embeddings[j]),
        }));
        await supabase.from("legal_knowledge_chunks").insert(rows);
      }

      jaExiste.add(reference.trim());
      inseridos++;
    }

    return new Response(
      JSON.stringify({ ok: true, recebidos: itens.length, inseridos, pulados, foraDoTema }),
      { headers: cors },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
