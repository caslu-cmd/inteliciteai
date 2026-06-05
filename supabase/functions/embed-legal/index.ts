import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf("Art. ", end));
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
    .sort((a, b) => a.index - b.index).map(d => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: cors });

  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]).maybeSingle();
  const { data: profileRow } = await supabase.from("profiles").select("platform_role, email").eq("id", user.id).maybeSingle();
  const isAdmin = !!roleRow || ["admin", "super_admin"].includes(profileRow?.platform_role ?? "");
  if (!isAdmin) return new Response(JSON.stringify({ error: "Apenas admins", debug: { userId: user.id, email: profileRow?.email, platform_role: profileRow?.platform_role, role: roleRow?.role } }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });


  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_KEY) return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), { status: 503, headers: cors });

  let body: { knowledgeId?: string; indexAll?: boolean };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: cors });
  }

  try {
    const { data: items } = body.knowledgeId
      ? await supabase.from("legal_knowledge").select("id, content").eq("id", body.knowledgeId)
      : body.indexAll
        ? await supabase.from("legal_knowledge").select("id, content").eq("active", true)
        : await supabase.from("legal_knowledge").select("id, content").eq("id", "none");

    if (!items?.length) return new Response(JSON.stringify({ indexed: 0 }), { headers: cors });

    let totalChunks = 0;
    const BATCH = 10;
    for (const item of items) {
      await supabase.from("legal_knowledge_chunks").delete().eq("knowledge_id", item.id);
      const chunks = chunkText(item.content);
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const embeddings = await embedBatch(batch, OPENAI_KEY);
        await supabase.from("legal_knowledge_chunks").insert(
          batch.map((c, j) => ({ knowledge_id: item.id, chunk_index: i + j, content: c, embedding: JSON.stringify(embeddings[j]) }))
        );
      }
      totalChunks += chunks.length;
    }

    return new Response(JSON.stringify({ indexed: items.length, chunks: totalChunks }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
