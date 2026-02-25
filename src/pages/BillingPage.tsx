import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Check, Loader2, Tag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [plansRes, subRes, payRes] = await Promise.all([
        supabase.from("plans").select("*").eq("active", true).order("price_cents"),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
        supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);

      setPlans(plansRes.data || []);
      setSubscription(subRes.data);
      setPayments(payRes.data || []);
      setLoading(false);
    })();
  }, []);

  const applyCoupon = async () => {
    if (!couponCode) return;
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.toUpperCase())
      .eq("active", true)
      .maybeSingle();

    if (!data) {
      toast({ title: "Cupom inválido", variant: "destructive" });
      return;
    }
    if (data.max_uses && data.used_count >= data.max_uses) {
      toast({ title: "Cupom esgotado", variant: "destructive" });
      return;
    }
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      toast({ title: "Cupom expirado", variant: "destructive" });
      return;
    }
    setCouponApplied(data);
    toast({ title: `Cupom aplicado: ${data.discount_percent}% de desconto!` });
  };

  // Check for payment status from URL (redirect back from Mercado Pago)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "approved") {
      toast({ title: "Pagamento aprovado!", description: "Sua assinatura será ativada em instantes." });
      // Reload subscription after a short delay for webhook to process
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: subData } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single();
          setSubscription(subData);
        }
      }, 3000);
      window.history.replaceState({}, "", "/billing");
    } else if (status === "rejected") {
      toast({ title: "Pagamento recusado", description: "Tente novamente ou use outro método.", variant: "destructive" });
      window.history.replaceState({}, "", "/billing");
    } else if (status === "pending") {
      toast({ title: "Pagamento pendente", description: "Aguardando confirmação do pagamento." });
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  const handleChangePlan = async (planName: string) => {
    setChangingPlan(planName);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const plan = plans.find((p) => p.name === planName);
    if (!plan) return;

    // Free plan: update directly (only gratuito)
    if (plan.name === "gratuito") {
      const { error } = await supabase.from("subscriptions").update({
        plan: planName as any,
        status: "trial" as any,
        price_cents: 0,
        gateway: null,
        coupon_id: null,
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("user_id", user.id);
      if (!error) {
        toast({ title: `Plano alterado para ${plan.display_name}!` });
        const { data: subData } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).single();
        setSubscription(subData);
      }
      setChangingPlan(null);
      return;
    }

    // Paid plan: create Mercado Pago checkout
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan_id: plan.id,
          coupon_id: couponApplied?.id || null,
        },
      });

      if (error) {
        console.error("Checkout error:", error);
        const errorMsg = typeof error === "object" && error?.message ? error.message : String(error);
        toast({ title: "Erro ao criar checkout", description: errorMsg, variant: "destructive" });
        setChangingPlan(null);
        return;
      }

      if (data?.error) {
        console.error("Checkout API error:", data);
        toast({ title: "Erro no checkout", description: data.details?.message || data.error, variant: "destructive" });
        setChangingPlan(null);
        return;
      }

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast({ title: "Erro ao gerar link de pagamento", variant: "destructive" });
      }
    } catch (err) {
      console.error("Unexpected checkout error:", err);
      toast({ title: "Erro inesperado", description: String(err), variant: "destructive" });
    }
    setChangingPlan(null);
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <CreditCard className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Billing & Assinatura</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu plano e pagamentos</p>
        </div>
      </div>

      {/* Current plan */}
      {subscription && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-lg font-bold capitalize">{subscription.plan?.replace("_", " ")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold",
                subscription.status === "active" ? "bg-success/10 text-success" :
                subscription.status === "trial" ? "bg-accent/10 text-accent" :
                "bg-destructive/10 text-destructive"
              )}>
                {subscription.status === "active" ? "Ativo" : subscription.status === "trial" ? "Trial" : subscription.status}
              </span>
            </div>
          </div>
          {subscription.trial_ends_at && subscription.status === "trial" && (
            <p className="text-xs text-muted-foreground mt-2">Trial expira em: {new Date(subscription.trial_ends_at).toLocaleDateString("pt-BR")}</p>
          )}
        </div>
      )}

      {/* Coupon & Payment */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium">Cupom de desconto</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Código do cupom" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
            <Button variant="outline" onClick={applyCoupon}>Aplicar</Button>
          </div>
          {couponApplied && <p className="text-xs text-success mt-2">{couponApplied.discount_percent}% de desconto aplicado!</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium">Pagamento via Mercado Pago</p>
          </div>
          <p className="text-xs text-muted-foreground">Aceita cartão de crédito, débito, PIX e boleto.</p>
        </div>
      </div>

      {/* Plans */}
      <h2 className="text-lg font-bold mb-4">Escolha seu plano</h2>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mb-8">
        {plans.map((plan, i) => {
          const isCurrent = subscription?.plan === plan.name;
          let price = plan.price_cents;
          if (couponApplied) price = Math.round(price * (1 - couponApplied.discount_percent / 100));
          const features = Array.isArray(plan.features) ? plan.features : [];

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn("rounded-xl border p-5 flex flex-col", isCurrent ? "border-accent bg-accent/5" : "border-border bg-card")}
            >
              <p className="font-bold text-sm">{plan.display_name}</p>
              <p className="text-2xl font-bold mt-2">
                {price === 0 ? "Grátis" : `R$ ${(price / 100).toFixed(0)}`}
                {price > 0 && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
              </p>
              {couponApplied && plan.price_cents > 0 && (
                <p className="text-xs text-muted-foreground line-through">R$ {(plan.price_cents / 100).toFixed(0)}/mês</p>
              )}
              <ul className="mt-4 space-y-1.5 flex-1">
                {features.map((f: string, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 mt-0.5 text-success shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? "outline" : "default"}
                size="sm"
                disabled={isCurrent || changingPlan === plan.name}
                onClick={() => handleChangePlan(plan.name)}
              >
                {changingPlan === plan.name && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isCurrent ? "Plano atual" : "Selecionar"}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Payment history */}
      <h2 className="text-lg font-bold mb-4">Histórico de Pagamentos</h2>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pagamento registrado</div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border last:border-b-0 px-4 py-3">
              <div>
                <p className="text-sm font-medium">R$ {(p.amount_cents / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                p.status === "paid" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
              )}>
                {p.status === "paid" ? "Pago" : "Pendente"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
