import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // 1. Block users whose trial expired (7+ days ago)
    const { data: expiredTrials } = await supabase
      .from("subscriptions")
      .select("user_id, trial_ends_at")
      .eq("status", "trial")
      .lt("trial_ends_at", now.toISOString());

    let blockedCount = 0;
    for (const sub of expiredTrials || []) {
      await supabase.from("subscriptions").update({ status: "blocked" }).eq("user_id", sub.user_id);

      // Get user email for notification
      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", sub.user_id).single();

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "Trial expirado",
        message: "Seu período de teste expirou. Assine um plano para continuar usando a plataforma.",
        type: "billing",
      });

      await supabase.from("activity_logs").insert({
        user_id: sub.user_id,
        user_email: profile?.email || "",
        action: "Bloqueio automático",
        details: `Trial expirado — ${profile?.full_name || profile?.email}`,
      });

      blockedCount++;
    }

    // 2. Block overdue users (7+ days past period end)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: overdueUsers } = await supabase
      .from("subscriptions")
      .select("user_id, current_period_end")
      .eq("status", "overdue")
      .lt("current_period_end", sevenDaysAgo.toISOString());

    for (const sub of overdueUsers || []) {
      await supabase.from("subscriptions").update({ status: "blocked" }).eq("user_id", sub.user_id);

      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", sub.user_id).single();

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "Conta bloqueada por inadimplência",
        message: "Sua conta foi bloqueada após 7 dias sem pagamento. Regularize para continuar.",
        type: "billing",
      });

      await supabase.from("activity_logs").insert({
        user_id: sub.user_id,
        user_email: profile?.email || "",
        action: "Bloqueio por inadimplência",
        details: `7+ dias sem pagamento — ${profile?.full_name || profile?.email}`,
      });

      blockedCount++;
    }

    // 3. Send billing reminders for active subs expiring in 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { data: expiringSoon } = await supabase
      .from("subscriptions")
      .select("user_id, current_period_end, plan")
      .eq("status", "active")
      .gt("price_cents", 0)
      .lt("current_period_end", threeDaysFromNow.toISOString())
      .gt("current_period_end", now.toISOString());

    let reminderCount = 0;
    for (const sub of expiringSoon || []) {
      // Check if we already sent a reminder today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub.user_id)
        .eq("type", "billing")
        .gte("created_at", todayStart.toISOString());

      if ((count || 0) === 0) {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "Pagamento próximo do vencimento",
          message: `Sua assinatura vence em ${new Date(sub.current_period_end).toLocaleDateString("pt-BR")}. Mantenha seu pagamento em dia.`,
          type: "billing",
        });
        reminderCount++;
      }
    }

    // 4. Send trial expiring reminders (2 days before)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const { data: trialExpiring } = await supabase
      .from("subscriptions")
      .select("user_id, trial_ends_at")
      .eq("status", "trial")
      .lt("trial_ends_at", twoDaysFromNow.toISOString())
      .gt("trial_ends_at", now.toISOString());

    for (const sub of trialExpiring || []) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub.user_id)
        .eq("type", "billing")
        .gte("created_at", todayStart.toISOString());

      if ((count || 0) === 0) {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "Seu trial está acabando!",
          message: `Seu período de teste expira em ${new Date(sub.trial_ends_at).toLocaleDateString("pt-BR")}. Assine um plano para não perder acesso.`,
          type: "billing",
        });
        reminderCount++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      blocked: blockedCount, 
      reminders: reminderCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Auto-block error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
