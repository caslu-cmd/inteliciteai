import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { event, payload, webhookConfigId } = body;
  if (!event || !payload) {
    return new Response(JSON.stringify({ error: "event e payload são obrigatórios" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Find matching configs (specific id or all user configs containing this event)
  const q = admin.from("webhook_configs").select("*").eq("user_id", userId).eq("active", true);
  const { data: configs, error: cfgErr } = webhookConfigId ? await q.eq("id", webhookConfigId) : await q;
  if (cfgErr) {
    return new Response(JSON.stringify({ error: "Falha ao buscar webhooks", detail: cfgErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const targets = (configs || []).filter(c => !Array.isArray(c.events) || c.events.length === 0 || c.events.includes(event));
  const results: any[] = [];

  for (const cfg of targets) {
    const bodyStr = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const signature = cfg.secret ? await hmacSha256Hex(cfg.secret, bodyStr) : null;

    let status = 0;
    let respText = "";
    let errMsg: string | null = null;
    try {
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          ...(signature ? { "X-Webhook-Signature": `sha256=${signature}` } : {}),
        },
        body: bodyStr,
      });
      status = res.status;
      respText = (await res.text()).slice(0, 2000);
    } catch (e) {
      errMsg = String(e);
    }

    await admin.from("webhook_logs").insert({
      webhook_config_id: cfg.id,
      event,
      payload,
      response_status: status,
      error: errMsg || (status >= 400 ? respText : null),
    });

    results.push({ webhook_id: cfg.id, url: cfg.url, status, error: errMsg });
  }

  return new Response(JSON.stringify({ ok: true, dispatched: results.length, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
