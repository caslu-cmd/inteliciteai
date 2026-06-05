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
