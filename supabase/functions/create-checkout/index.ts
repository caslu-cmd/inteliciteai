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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_id, coupon_id } = await req.json();

    // Get plan
    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();
    if (!plan || plan.price_cents === 0) {
      return new Response(JSON.stringify({ error: "Plano inválido ou gratuito" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply coupon if provided
    let finalPrice = plan.price_cents;
    let couponData = null;
    if (coupon_id) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("id", coupon_id)
        .eq("active", true)
        .single();
      if (coupon) {
        finalPrice = Math.round(finalPrice * (1 - coupon.discount_percent / 100));
        couponData = coupon;
      }
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        amount_cents: finalPrice,
        gateway: "mercado_pago",
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      return new Response(JSON.stringify({ error: "Erro ao criar pagamento", details: paymentError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the public URL for callbacks
    const appUrl = req.headers.get("origin") || "https://inteliciteai.lovable.app";
    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    // Create Mercado Pago preference
    const preference = {
      items: [
        {
          title: `Plano ${plan.display_name} - InteliciteAI`,
          quantity: 1,
          unit_price: finalPrice / 100,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: profile?.email || user.email,
        name: profile?.full_name || "",
      },
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
      back_urls: {
        success: `${appUrl}/billing?status=approved`,
        failure: `${appUrl}/billing?status=rejected`,
        pending: `${appUrl}/billing?status=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      external_reference: JSON.stringify({
        payment_id: payment.id,
        user_id: user.id,
        plan_name: plan.name,
        coupon_id: couponData?.id || null,
      }),
      statement_descriptor: "INTELICITEAI",
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      return new Response(JSON.stringify({ error: "Erro no Mercado Pago", details: mpData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment with MP preference id
    await supabase
      .from("payments")
      .update({ gateway_payment_id: mpData.id })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        checkout_url: mpData.init_point,
        payment_id: payment.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
