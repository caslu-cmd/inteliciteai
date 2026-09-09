import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API = "https://api.resend.com/emails";

function resetEmailHtml(resetUrl: string) {
  return `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
        <h1 style="color:#f59e0b;font-size:26px;margin:0;letter-spacing:-0.5px">Intelicite AI</h1>
        <p style="color:rgba(255,255,255,0.5);margin:8px 0 0;font-size:14px">Redefinição de senha</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#fff;font-size:20px;margin:0 0 12px">Redefinir sua senha 🔒</h2>
        <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 20px">
          Recebemos um pedido para redefinir a senha da sua conta na
          <strong style="color:#f59e0b">Intelicite AI</strong>. Clique no botão abaixo para criar uma nova senha.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
          Redefinir senha →
        </a>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;margin:24px 0 0">
          Este link expira em 1 hora e só pode ser usado uma vez.
          Se você não solicitou a redefinição, ignore este e-mail — sua senha continua a mesma.
        </p>
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
          <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
            Fundamentado na Lei 14.133/2021 · Intelicite AI
          </p>
        </div>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Resposta sempre "success" para não revelar se o e-mail existe (evita enumeração).
  const ok = () =>
    new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  let body: { email?: string; redirectTo?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const email = body.email?.trim().toLowerCase();
  const redirectTo = body.redirectTo;
  if (!email) {
    return new Response(JSON.stringify({ error: "Campo 'email' obrigatório" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_KEY) return ok(); // sem provedor configurado — não vaza nada

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gera o link de recuperação (token seguro emitido pelo próprio Supabase Auth).
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    const actionLink = data?.properties?.action_link;
    // Usuário não existe ou erro: responde success mesmo assim (sem enumeração).
    if (error || !actionLink) return ok();

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "Intelicite AI <noreply@intelicite.com.br>",
        to: [email],
        subject: "Redefinição de senha — Intelicite AI",
        html: resetEmailHtml(actionLink),
      }),
    });

    if (!res.ok) {
      // Loga no servidor mas não expõe ao cliente.
      console.error("Resend erro:", res.status, await res.text());
    }

    return ok();
  } catch (err) {
    console.error("send-reset-password:", err);
    return ok();
  }
});
