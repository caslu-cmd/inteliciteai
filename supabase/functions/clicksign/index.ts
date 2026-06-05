import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_BASE = Deno.env.get("CLICKSIGN_BASE_URL") ?? "https://sandbox.clicksign.com/api/v1";
const CLICKSIGN_TOKEN = Deno.env.get("CLICKSIGN_ACCESS_TOKEN") ?? "";

async function clicksignRequest(path: string, method = "GET", body?: unknown) {
  const url = `${CLICKSIGN_BASE}${path}?access_token=${CLICKSIGN_TOKEN}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.join(", ") ?? `ClickSign ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }

  const { action } = body;

  try {
    // ── Criar documento no ClickSign ─────────────────────────────
    if (action === "create_document") {
      const { documentId, pdfBase64, fileName, signerName, signerEmail, signerCpf } = body as {
        documentId: string; pdfBase64: string; fileName: string;
        signerName: string; signerEmail: string; signerCpf?: string;
      };

      // 1. Criar documento
      const docRes = await clicksignRequest("/documents", "POST", {
        document: {
          path: `/${fileName}.pdf`,
          content_base64: `data:application/pdf;base64,${pdfBase64}`,
          deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          auto_close: true,
          locale: "pt-BR",
          sequence_enabled: false,
        },
      });
      const clicksignKey = docRes.document.key;

      // 2. Adicionar signatário
      const signerRes = await clicksignRequest("/signers", "POST", {
        signer: {
          email: signerEmail,
          phone_number: "",
          auths: ["email"],
          name: signerName,
          documentation: signerCpf ?? "",
          birthday: "",
          has_documentation: !!signerCpf,
        },
      });
      const signerKey = signerRes.signer.key;

      // 3. Vincular signatário ao documento
      await clicksignRequest("/lists", "POST", {
        list: {
          document_key: clicksignKey,
          signer_key: signerKey,
          sign_as: "sign",
          message: "Por favor, assine o documento gerado pelo InteliCite AI.",
        },
      });

      // 4. Notificar signatário
      await clicksignRequest("/notifications", "POST", {
        message: {
          document_key: clicksignKey,
          signer_key: signerKey,
          message: "Você recebeu um documento para assinatura via InteliCite AI.",
        },
      });

      // 5. Salvar no banco
      await supabase.from("document_signatures").insert({
        document_id: documentId,
        user_id: user.id,
        clicksign_key: clicksignKey,
        status: "sent",
        signer_name: signerName,
        signer_email: signerEmail,
        signer_cpf: signerCpf ?? null,
      });

      // 6. Disparar webhook documento.sent
      await supabase.functions.invoke("dispatch-webhook", {
        body: {
          userId: user.id,
          event: "document.signed_request",
          payload: { documentId, signerEmail, signerName, clicksignKey },
        },
      });

      return new Response(JSON.stringify({ ok: true, clicksignKey }), { headers: cors });
    }

    // ── Consultar status ─────────────────────────────────────────
    if (action === "get_status") {
      const { signatureId } = body as { signatureId: string };
      const { data: sig } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("id", signatureId)
        .single();

      if (!sig) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });

      const csDoc = await clicksignRequest(`/documents/${sig.clicksign_key}`);
      const status = csDoc.document.status === "closed" ? "signed" : sig.status;

      if (status === "signed" && sig.status !== "signed") {
        await supabase.from("document_signatures").update({ status: "signed", signed_at: new Date().toISOString() }).eq("id", signatureId);
        await supabase.functions.invoke("dispatch-webhook", {
          body: { userId: user.id, event: "document.signed", payload: { documentId: sig.document_id } },
        });
      }

      return new Response(JSON.stringify({ status, document: csDoc.document }), { headers: cors });
    }

    // ── Cancelar ─────────────────────────────────────────────────
    if (action === "cancel") {
      const { signatureId } = body as { signatureId: string };
      const { data: sig } = await supabase.from("document_signatures").select("clicksign_key").eq("id", signatureId).single();
      if (sig?.clicksign_key) await clicksignRequest(`/documents/${sig.clicksign_key}/cancel`, "PATCH");
      await supabase.from("document_signatures").update({ status: "cancelled" }).eq("id", signatureId);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: cors });
  }
});
