import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hmacSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode(body)))
    .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join(""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { userId: string; event: string; payload: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }

  const { userId, event, payload } = body;

  // Buscar webhooks ativos do usuário para este evento
  const { data: configs } = await supabase
    .from("webhook_configs")
    .select("id, url, secret")
    .eq("user_id", userId)
    .eq("active", true)
    .contains("events", [event]);

  if (!configs || configs.length === 0) {
    return new Response(JSON.stringify({ dispatched: 0 }), { headers: cors });
  }

  const dispatched = await Promise.all(
    configs.map(async (cfg: { id: string; url: string; secret: string | null }) => {
      const webhookBody = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "InteliCite-Webhook/1.0",
        "X-InteliCite-Event": event,
      };

      if (cfg.secret) {
        headers["X-InteliCite-Signature"] = `sha256=${await hmacSignature(cfg.secret, webhookBody)}`;
      }

      let responseStatus: number | null = null;
      let error: string | null = null;

      try {
        const res = await fetch(cfg.url, { method: "POST", headers, body: webhookBody, signal: AbortSignal.timeout(10000) });
        responseStatus = res.status;
      } catch (err) {
        error = err instanceof Error ? err.message : "Fetch failed";
      }

      // Registrar log
      await supabase.from("webhook_logs").insert({
        webhook_config_id: cfg.id,
        event,
        payload,
        response_status: responseStatus,
        error,
      });

      return { url: cfg.url, status: responseStatus, error };
    })
  );

  return new Response(JSON.stringify({ dispatched: dispatched.length, results: dispatched }), { headers: cors });
});
