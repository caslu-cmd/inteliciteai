import { supabase } from "@/integrations/supabase/client";

type EmailTemplate =
  | "welcome"
  | "subscription_activated"
  | "document_generated"
  | "consultant_status"
  | "module_unlocked"
  | "module_cancelled"
  | "subscription_cancelled"
  | "custom";

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, unknown> = {}
) {
  await supabase.functions.invoke("send-email", {
    body: { to, template, data },
  }).catch(() => {/* best-effort */});
}

/**
 * Dispara o e-mail de redefinição de senha via Resend (edge function
 * send-reset-password). Sempre resolve sem erro — a função nunca revela se o
 * e-mail existe, para evitar enumeração de contas.
 */
export async function sendPasswordReset(email: string) {
  await supabase.functions.invoke("send-reset-password", {
    body: {
      email,
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`,
    },
  }).catch(() => {/* best-effort — não expõe estado ao usuário */});
}
