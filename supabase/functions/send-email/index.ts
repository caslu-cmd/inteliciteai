import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API = "https://api.resend.com/emails";

const EMAIL_TEMPLATES: Record<string, (data: any) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: "Bem-vindo à Intelicite AI!",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <h1 style="color:#f59e0b;font-size:28px;margin:0;letter-spacing:-0.5px">Intelicite AI</h1>
          <p style="color:rgba(255,255,255,0.5);margin:8px 0 0;font-size:14px">Plataforma de Inteligência em Licitações</p>
        </div>
        <div style="padding:32px">
          <h2 style="color:#fff;font-size:20px;margin:0 0 12px">Olá, ${d.name || "usuário"}! 👋</h2>
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 20px">
            Sua conta na <strong style="color:#f59e0b">Intelicite AI</strong> foi criada com sucesso.
            Acesse a plataforma para explorar todas as ferramentas de IA para licitações públicas.
          </p>
          <a href="${d.loginUrl || "https://intelicite.ai/login"}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Acessar plataforma →
          </a>
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)">
            <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
              Fundamentado na Lei 14.133/2021 · Intelicite AI
            </p>
          </div>
        </div>
      </div>
    `,
  }),

  subscription_activated: (d) => ({
    subject: `Plano ${d.plan || "Pro"} ativado — Intelicite AI`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:8px">🎉</div>
          <h1 style="color:#f59e0b;font-size:24px;margin:0">Plano ativado!</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 20px">
            Seu plano <strong style="color:#f59e0b">${d.plan || "Pro"}</strong> foi ativado com sucesso.
            Você agora tem acesso completo a todas as ferramentas da Intelicite AI.
          </p>
          <a href="${d.dashboardUrl || "https://intelicite.ai/dashboard"}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Ir para o Dashboard →
          </a>
        </div>
      </div>
    `,
  }),

  document_generated: (d) => ({
    subject: `Seu ${d.tipo?.toUpperCase() || "documento"} foi gerado — Intelicite AI`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <h1 style="color:#f59e0b;font-size:22px;margin:0">Documento gerado ✓</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 12px">
            Seu <strong style="color:#fff">${d.tipo?.toUpperCase() || "documento"}</strong>
            <em style="color:rgba(255,255,255,0.5)">"${d.titulo || "Sem título"}"</em> foi gerado com sucesso pela IA.
          </p>
          <a href="${d.documentsUrl || "https://intelicite.ai/dashboard/documents"}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Ver documento →
          </a>
        </div>
      </div>
    `,
  }),

  consultant_status: (d) => ({
    subject: `Atualização da sua verificação de consultor — Intelicite AI`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <h1 style="color:#f59e0b;font-size:22px;margin:0">Verificação de Consultor</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 12px">
            Olá, ${d.name || "consultor"}. O status da sua verificação foi atualizado para:
          </p>
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:18px;font-weight:700;color:${d.status === "approved" ? "#10b981" : d.status === "rejected" ? "#ef4444" : "#f59e0b"}">
              ${d.status === "approved" ? "✅ Aprovado" : d.status === "rejected" ? "❌ Rejeitado" : "⏳ Em revisão"}
            </p>
            ${d.reason ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:13px">${d.reason}</p>` : ""}
          </div>
          <a href="${d.consultorUrl || "https://intelicite.ai/consultor"}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Ver portal →
          </a>
        </div>
      </div>
    `,
  }),

  module_unlocked: (d) => ({
    subject: `${d.module || "Módulo"} desbloqueado — Intelicite AI`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:8px">🔓</div>
          <h1 style="color:#f59e0b;font-size:22px;margin:0">${d.module || "Módulo"} desbloqueado!</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 16px">
            Você acabou de desbloquear o <strong style="color:#f59e0b">${d.module || "módulo"}</strong>.
            O acesso está ativo imediatamente.
          </p>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 20px">
            💳 Próxima cobrança: <strong style="color:#fff">${d.nextBilling || "mês seguinte"}</strong>
          </p>
          <a href="${d.dashboardUrl || "https://intelicite.ai/dashboard"}" style="display:inline-block;background:#f59e0b;color:#0b1120;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Acessar agora →
          </a>
          <p style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:24px">
            Você pode cancelar a qualquer momento em Configurações → Módulos. Sem reembolso proporcional.
          </p>
        </div>
      </div>`,
  }),

  module_cancelled: (d) => ({
    subject: `${d.module || "Módulo"} cancelado — Intelicite AI`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <h1 style="color:#f59e0b;font-size:22px;margin:0">Módulo cancelado</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 16px">
            O <strong style="color:#fff">${d.module || "módulo"}</strong> foi cancelado.
            Seu acesso permanece ativo até o fim do período pago.
          </p>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 20px">
            📅 Acesso até: <strong style="color:#fff">${d.accessUntil || "fim do período"}</strong>
          </p>
          <a href="${d.modulesUrl || "https://intelicite.ai/dashboard/modulos"}" style="display:inline-block;background:rgba(255,255,255,0.1);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Ver módulos →
          </a>
        </div>
      </div>`,
  }),

  subscription_cancelled: (d) => ({
    subject: "Assinatura cancelada — Intelicite AI",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0b1120;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0b1120);padding:40px 32px;text-align:center">
          <h1 style="color:#f59e0b;font-size:22px;margin:0">Assinatura cancelada</h1>
        </div>
        <div style="padding:32px">
          <p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 16px">
            Sua assinatura foi cancelada. Você continua com acesso até o fim do período pago — sem reembolso proporcional.
          </p>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 20px">
            📅 Acesso até: <strong style="color:#fff">${d.accessUntil || "fim do período"}</strong>
          </p>
          <a href="${d.billingUrl || "https://intelicite.ai/dashboard/billing"}" style="display:inline-block;background:rgba(255,255,255,0.1);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Reativar assinatura →
          </a>
        </div>
      </div>`,
  }),

  custom: (d) => ({
    subject: d.subject || "Mensagem da Intelicite AI",
    html: d.html || `<p>${d.text || ""}</p>`,
  }),
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada" }), {
      status: 503, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { to, template = "custom", data = {}, from } = body;

  if (!to) {
    return new Response(JSON.stringify({ error: "Campo 'to' obrigatório" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const templateFn = EMAIL_TEMPLATES[template] || EMAIL_TEMPLATES.custom;
  const { subject, html } = templateFn(data);

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: from || "Intelicite AI <noreply@intelicite.ai>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend ${res.status}: ${err}`);
    }

    const result = await res.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Falha ao enviar e-mail", detail: String(err) }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
