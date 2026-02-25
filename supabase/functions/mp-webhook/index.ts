import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mercado Pago sends different notification formats
    const body = await req.json();
    console.log("MP Webhook received:", JSON.stringify(body));

    // Handle IPN (Instant Payment Notification)
    let paymentMpId: string | null = null;

    if (body.type === "payment" && body.data?.id) {
      paymentMpId = String(body.data.id);
    } else if (body.action === "payment.updated" || body.action === "payment.created") {
      paymentMpId = String(body.data?.id);
    } else {
      // Not a payment notification, acknowledge
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymentMpId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details from Mercado Pago API
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentMpId}`,
      {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      }
    );

    if (!mpResponse.ok) {
      console.error("Failed to fetch MP payment:", await mpResponse.text());
      return new Response(JSON.stringify({ error: "Falha ao consultar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPayment = await mpResponse.json();
    console.log("MP Payment details:", JSON.stringify({
      id: mpPayment.id,
      status: mpPayment.status,
      external_reference: mpPayment.external_reference,
    }));

    // Parse external reference
    let externalRef: any = {};
    try {
      externalRef = JSON.parse(mpPayment.external_reference || "{}");
    } catch {
      console.error("Failed to parse external_reference");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payment_id, user_id, plan_name, coupon_id } = externalRef;

    if (!payment_id || !user_id) {
      console.error("Missing payment_id or user_id in external_reference");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map MP status to our status
    const statusMap: Record<string, string> = {
      approved: "paid",
      authorized: "paid",
      pending: "pending",
      in_process: "pending",
      rejected: "rejected",
      cancelled: "rejected",
      refunded: "refunded",
      charged_back: "refunded",
    };

    const ourStatus = statusMap[mpPayment.status] || "pending";

    // Update payment record
    await supabase
      .from("payments")
      .update({
        status: ourStatus,
        gateway_payment_id: String(mpPayment.id),
        paid_at: ourStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", payment_id);

    // If paid, activate subscription
    if (ourStatus === "paid" && plan_name) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await supabase
        .from("subscriptions")
        .update({
          plan: plan_name,
          status: "active",
          gateway: "mercado_pago",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          coupon_id: coupon_id || null,
          price_cents: Math.round(mpPayment.transaction_amount * 100),
        })
        .eq("user_id", user_id);

      // Increment coupon usage
      if (coupon_id) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("used_count")
          .eq("id", coupon_id)
          .single();
        if (coupon) {
          await supabase
            .from("coupons")
            .update({ used_count: coupon.used_count + 1 })
            .eq("id", coupon_id);
        }
      }

      // Create notification
      await supabase.from("notifications").insert({
        user_id,
        title: "Pagamento confirmado!",
        message: `Seu plano ${plan_name} foi ativado com sucesso. Obrigado pelo pagamento!`,
        type: "billing",
      });

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id,
        action: "payment_confirmed",
        details: `Pagamento MP #${mpPayment.id} confirmado. Plano: ${plan_name}`,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
