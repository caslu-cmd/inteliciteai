import { supabase } from "@/integrations/supabase/client";

export async function dispatchWebhook(event: string, payload: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.functions.invoke("dispatch-webhook", {
    body: { userId: user.id, event, payload },
  }).catch(() => {/* webhooks são best-effort, não bloqueia o fluxo */});
}
