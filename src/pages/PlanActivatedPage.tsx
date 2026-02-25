import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function PlanActivatedPage() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setSubscription(data);
          if (data.status === "active") {
            setLoading(false);
            clearInterval(poll);
          }
        }
      }
      if (attempts >= 20) {
        setLoading(false);
        clearInterval(poll);
      }
    }, 3000);

    return () => clearInterval(poll);
  }, []);

  const isActive = subscription?.status === "active";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        {loading ? (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-accent mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Processando pagamento...</h1>
            <p className="text-muted-foreground">
              Aguardando confirmação do Mercado Pago. Isso pode levar alguns segundos.
            </p>
          </>
        ) : isActive ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            >
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-6" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-2">Plano ativado com sucesso! 🎉</h1>
            <p className="text-muted-foreground mb-2">
              Seu plano <span className="font-semibold capitalize">{subscription.plan?.replace("_", " ")}</span> está ativo.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Válido até {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR") : "—"}
            </p>
            <Button onClick={() => navigate("/dashboard")} className="gap-2">
              Ir para o Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Pagamento pendente</h1>
            <p className="text-muted-foreground mb-6">
              Ainda não recebemos a confirmação. Seu plano será ativado automaticamente assim que o pagamento for processado.
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard/billing")}>
              Voltar para Billing
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
