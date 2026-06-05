import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_API = Deno.env.get("CLICKSIGN_API_URL") || "https://app.clicksign.com/api/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  const apiToken = Deno.env.get("CLICKSIGN_API_TOKEN");
  if (!apiToken) {
    return new Response(JSON.stringify({ error: "Clicksign não configurado. Adicione CLICKSIGN_API_TOKEN nos secrets." }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { action, documentId, signerName, signerEmail, contentBase64, filename } = body;

  try {
    if (action === "send") {
      if (!signerName || !signerEmail || !contentBase64) {
        return new Response(JSON.stringify({ error: "signerName, signerEmail e contentBase64 são obrigatórios" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // 1. Upload document
      const docRes = await fetch(`${CLICKSIGN_API}/documents?access_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          document: {
            path: `/${filename || "documento.pdf"}`,
            content_base64: `data:application/pdf;base64,${contentBase64}`,
            auto_close: true,
          },
        }),
      });
      if (!docRes.ok) throw new Error(`Clicksign upload ${docRes.status}: ${await docRes.text()}`);
      const docData = await docRes.json();
      const clicksignKey = docData.document?.key;

      // 2. Create signer
      const signerRes = await fetch(`${CLICKSIGN_API}/signers?access_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          signer: { email: signerEmail, name: signerName, auths: ["email"], delivery: "email" },
        }),
      });
      if (!signerRes.ok) throw new Error(`Clicksign signer ${signerRes.status}: ${await signerRes.text()}`);
      const signerData = await signerRes.json();
      const signerKey = signerData.signer?.key;

      // 3. Add signer to document
      await fetch(`${CLICKSIGN_API}/lists?access_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          list: { document_key: clicksignKey, signer_key: signerKey, sign_as: "sign" },
        }),
      });

      // 4. Persist record
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: sig, error: sigErr } = await admin.from("document_signatures").insert({
        document_id: documentId ?? null,
        user_id: userId,
        clicksign_key: clicksignKey,
        status: "sent",
        signer_name: signerName,
        signer_email: signerEmail,
      }).select().single();
      if (sigErr) console.error("[clicksign] persist error", sigErr);

      return new Response(JSON.stringify({ ok: true, clicksign_key: clicksignKey, signature: sig }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { clicksignKey } = body;
      if (!clicksignKey) {
        return new Response(JSON.stringify({ error: "clicksignKey obrigatório" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${CLICKSIGN_API}/documents/${clicksignKey}?access_token=${apiToken}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Clicksign status ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      const { clicksignKey } = body;
      if (!clicksignKey) {
        return new Response(JSON.stringify({ error: "clicksignKey obrigatório" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      await fetch(`${CLICKSIGN_API}/documents/${clicksignKey}/cancel?access_token=${apiToken}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await admin.from("document_signatures").update({ status: "cancelled" }).eq("clicksign_key", clicksignKey);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida (send|status|cancel)" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[clicksign]", err);
    return new Response(JSON.stringify({ error: "Falha Clicksign", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
