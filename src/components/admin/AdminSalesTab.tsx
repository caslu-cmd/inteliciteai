import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const gatewayLabels: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  gerencianet: "Gerencianet",
  pagar_me: "Pagar.me",
};

export default function AdminSalesTab() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(50);
      setPayments(data || []);
      setLoading(false);
    })();
  }, []);

  const statusLabels: Record<string, { label: string; class: string }> = {
    paid: { label: "Pago", class: "bg-success/10 text-success" },
    pending: { label: "Pendente", class: "bg-accent/10 text-accent" },
    failed: { label: "Falhou", class: "bg-destructive/10 text-destructive" },
    refunded: { label: "Reembolsado", class: "bg-muted text-muted-foreground" },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Data</div>
          <div className="col-span-3">Usuário</div>
          <div className="col-span-2">Valor</div>
          <div className="col-span-2">Gateway</div>
          <div className="col-span-3">Status</div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pagamento registrado</div>
        ) : (
          payments.map((p) => {
            const st = statusLabels[p.status] || statusLabels.pending;
            return (
              <div key={p.id} className="grid grid-cols-12 gap-4 items-center border-b border-border last:border-b-0 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="col-span-2 text-sm text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="col-span-3 text-sm truncate">{(p.profiles as any)?.full_name || (p.profiles as any)?.email || "—"}</div>
                <div className="col-span-2 text-sm font-medium">R$ {(p.amount_cents / 100).toFixed(2)}</div>
                <div className="col-span-2 text-sm text-muted-foreground">{gatewayLabels[p.gateway] || p.gateway}</div>
                <div className="col-span-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.class}`}>{st.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
