import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminMetricsTab() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    trialUsers: 0,
    blockedUsers: 0,
    totalRevenue: 0,
    paidUsers: 0,
  });

  useEffect(() => {
    (async () => {
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: subs } = await supabase.from("subscriptions").select("*");
      const { data: payments } = await supabase.from("payments").select("amount_cents").eq("status", "paid");

      const activeUsers = subs?.filter((s: any) => s.status === "active").length || 0;
      const trialUsers = subs?.filter((s: any) => s.status === "trial").length || 0;
      const blockedUsers = subs?.filter((s: any) => s.status === "blocked").length || 0;
      const paidUsers = subs?.filter((s: any) => ["active"].includes(s.status) && s.price_cents > 0).length || 0;
      const totalRevenue = payments?.reduce((sum: number, p: any) => sum + p.amount_cents, 0) || 0;

      setMetrics({ totalUsers: totalUsers || 0, activeUsers, trialUsers, blockedUsers, totalRevenue, paidUsers });
    })();
  }, []);

  const cards = [
    { label: "Total de Usuários", value: metrics.totalUsers.toString(), icon: Users, color: "text-accent" },
    { label: "Usuários Ativos", value: metrics.activeUsers.toString(), icon: TrendingUp, color: "text-success" },
    { label: "Em Trial", value: metrics.trialUsers.toString(), icon: Users, color: "text-accent" },
    { label: "Bloqueados", value: metrics.blockedUsers.toString(), icon: Users, color: "text-destructive" },
    { label: "Receita Total", value: `R$ ${(metrics.totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: CreditCard, color: "text-success" },
    { label: "Assinantes Pagos", value: metrics.paidUsers.toString(), icon: FileText, color: "text-accent" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <p className="text-2xl font-bold">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Distribuição por Plano</h3>
        <div className="space-y-3">
          {[
            { name: "Gratuito", key: "gratuito" },
            { name: "Profissional", key: "profissional" },
            { name: "Gestor Público", key: "gestor_publico" },
            { name: "Empresa", key: "empresa" },
            { name: "Institucional", key: "institucional" },
          ].map((plan) => (
            <PlanBar key={plan.key} name={plan.name} planKey={plan.key} total={metrics.totalUsers} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function PlanBar({ name, planKey, total }: { name: string; planKey: string; total: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("plan", planKey as any).then(({ count: c }) => setCount(c || 0));
  }, [planKey]);

  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-muted-foreground">{name}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full bg-gradient-gold rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
      </div>
      <span className="text-sm font-medium w-16 text-right">{count} ({pct}%)</span>
    </div>
  );
}
