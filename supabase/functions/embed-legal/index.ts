const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function getUser(token: string): Promise<{ id: string; email?: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { await res.text(); return null; }
  return await res.json();
}

function chunkText(text: string, size = 800, overlap = 120) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("\n", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf("Art. ", end),
      );
      if (boundary > start + size - 200) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content.length > 30) chunks.push(content);
    start = end - overlap;
    if (start >= end) start = end;
  }
  return chunks;
}

async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text, dimensions: 1536 }),
  });
  if (!res.ok) throw new Error(`Embed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    console.log("step:getUser");
    const user = await getUser(token);
    if (!user) return json({ error: "Token inválido" }, 401);
    console.log("step:user", user.id);

    const roles = await rest(`user_roles?user_id=eq.${user.id}&select=role`);
    console.log("step:roles", JSON.stringify(roles));
    const profile = await rest(`profiles?id=eq.${user.id}&select=platform_role,email`);
    console.log("step:profile", JSON.stringify(profile));

    const roleList: string[] = (roles ?? []).map((r: any) => r.role);
    const platformRole: string = profile?.[0]?.platform_role ?? "";
    const isAdmin =
      roleList.includes("admin") ||
      roleList.includes("super_admin") ||
      ["admin", "super_admin"].includes(platformRole);

    if (!isAdmin) {
      return json({
        error: "Apenas admins",
        debug: { userId: user.id, email: profile?.[0]?.email, roles: roleList, platform_role: platformRole },
      }, 403);
    }

    const API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 503);


    let body: { knowledgeId?: string; indexAll?: boolean };
    try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

    const filter = body.knowledgeId
      ? `id=eq.${body.knowledgeId}`
      : body.indexAll
        ? `active=eq.true`
        : `id=eq.00000000-0000-0000-0000-000000000000`;

    const items: { id: string; content: string }[] =
      await rest(`legal_knowledge?${filter}&select=id,content`);
    console.log("step:items", items?.length);

    if (!items?.length) return json({ indexed: 0 });

    let totalChunks = 0;
    for (const item of items) {
      console.log("step:item", item.id, item.content.length);
      await rest(`legal_knowledge_chunks?knowledge_id=eq.${item.id}`, { method: "DELETE" });
      console.log("step:deleted");
      const chunks = item.content.length > 0 ? [item.content] : [];
      console.log("step:chunks", chunks.length);
      totalChunks += chunks.length;
    }



    return json({ indexed: items.length, chunks: totalChunks });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
