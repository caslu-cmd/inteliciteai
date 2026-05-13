import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, FileText, MessageSquare, Loader2, CreditCard,
  Calendar, TrendingUp, Download, Clock, CheckCircle, AlertTriangle,
  BookMarked,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { exportAsPdf } from "@/lib/exportDocument";

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  amount_cents: number;
  status: string;
  gateway: string;
  paid_at: string | null;
  created_at: string;
}

const COLORS = ["hsl(var(--accent))", "hsl(var(--primary))", "hsl(var(--success, 142 71% 45%))", "hsl(var(--destructive))"];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [docCount, setDocCount] = useState(0);
  const [etpCount, setEtpCount] = useState(0);
  const [trCount, setTrCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [notebookCount, setNotebookCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [logsRes, paymentsRes, subRes, profileRes, docsRes, chatsRes, notebookRes] = await Promise.all([
        supabase.from("activity_logs").select("id, action, details, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("documents").select("id, tipo").eq("user_id", user.id),
        supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("notebook_sources").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const docs = docsRes.data || [];
      setDocCount(docs.length);
      setEtpCount(docs.filter(d => d.tipo === "etp").length);
      setTrCount(docs.filter(d => d.tipo === "tr").length);
      setChatCount(chatsRes.count || 0);
      setNotebookCount(notebookRes.count || 0);
      setLogs(logsRes.data || []);
      setPayments(paymentsRes.data || []);
      setSubscription(subRes.data);
      setProfile(profileRes.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  // --- Computed from activity_logs ---
  const validationCount = logs.filter((l) => l.action?.includes("Valid") || l.action?.includes("Diagnóst")).length;
  const loginCount = logs.filter((l) => l.action?.includes("Login") || l.action?.includes("login")).length;

  // Monthly activity chart (last 6 months)
  const monthlyData = (() => {
    const months: Record<string, { docs: number; chats: number; outros: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      months[key] = { docs: 0, chats: 0, outros: 0 };
    }
    logs.forEach((l) => {
      const d = new Date(l.created_at);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!(key in months)) return;
      if (l.action?.includes("Gerou") || l.action?.includes("ETP") || l.action?.includes("TR")) months[key].docs++;
      else if (l.action?.includes("Chat") || l.action?.includes("chat")) months[key].chats++;
      else months[key].outros++;
    });
    return Object.entries(months).map(([name, v]) => ({ name, Documentos: v.docs, Chats: v.chats, Outros: v.outros }));
  })();

  // Activity by type for pie chart
  const pieData = [
    { name: "ETPs", value: etpCount },
    { name: "TRs", value: trCount },
    { name: "Chats IA", value: chatCount },
    { name: "Fontes Notebook", value: notebookCount },
  ].filter((d) => d.value > 0);

  // Payments total
  const totalPaid = payments.filter((p) => p.status === "paid" || p.status === "approved").reduce((a, p) => a + p.amount_cents, 0);
  const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const planLabel: Record<string, string> = {
    gratuito: "Gratuito",
    profissional: "Profissional",
    gestor_publico: "Gestor Público",
    empresa: "Empresa",
    institucional: "Institucional",
  };

  const statusLabel: Record<string, { text: string; class: string }> = {
    trial: { text: "Em Trial", class: "text-warning" },
    active: { text: "Ativo", class: "text-success" },
    overdue: { text: "Inadimplente", class: "text-destructive" },
    expired: { text: "Expirado", class: "text-muted-foreground" },
    blocked: { text: "Bloqueado", class: "text-destructive" },
    cancelled: { text: "Cancelado", class: "text-muted-foreground" },
  };

  const handleExportReport = () => {
    const sections = [
      { title: "Resumo de Uso", content: `Documentos gerados: ${docCount}\nConversas com IA: ${chatCount}\nValidações/Diagnósticos: ${validationCount}\nAcessos: ${loginCount}\nTotal de ações: ${logs.length}` },
      { title: "Assinatura", content: `Plano: ${planLabel[subscription?.plan] || "—"}\nStatus: ${statusLabel[subscription?.status]?.text || "—"}\nValor: ${subscription ? fmt(subscription.price_cents) : "—"}/mês` },
      { title: "Pagamentos", content: payments.length > 0 ? payments.map((p) => `${new Date(p.created_at).toLocaleDateString("pt-BR")} — ${fmt(p.amount_cents)} — ${p.status}`).join("\n") : "Nenhum pagamento registrado" },
      { title: "Atividade Recente", content: logs.slice(0, 20).map((l) => `${new Date(l.created_at).toLocaleDateString("pt-BR")} ${new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${l.action}${l.details ? ` (${l.details})` : ""}`).join("\n") },
    ];
    exportAsPdf({ documentTitle: `Relatório de Uso — ${profile?.full_name || "Usuário"}`, legalBasis: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`, sections });
  };

  const kpis = [
    { label: "ETPs gerados", value: etpCount, sub: `${trCount} TR${trCount !== 1 ? "s" : ""} • ${docCount} total`, icon: FileText, color: "text-accent" },
    { label: "Conversas com IA", value: chatCount, sub: "histórico salvo", icon: MessageSquare, color: "text-primary" },
    { label: "Fontes no Notebook IA", value: notebookCount, sub: "editais, preços, contratos", icon: BookMarked, color: "text-amber-500" },
    { label: "Total investido", value: fmt(totalPaid), sub: subscription ? `Plano ${planLabel[subscription.plan] || subscription.plan}` : "sem assinatura", icon: CreditCard, color: "text-accent" },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Dados reais de uso da plataforma</p>
          </div>
        </div>
        <Button onClick={handleExportReport} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-xl border border-border bg-card p-5">
            <c.icon className={`h-5 w-5 ${c.color} mb-3`} />
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm font-medium mt-0.5">{c.label}</p>
            {"sub" in c && <p className="text-[11px] text-muted-foreground mt-0.5">{(c as any).sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Subscription Info */}
      {subscription && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Assinatura</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Plano</p>
              <p className="font-semibold">{planLabel[subscription.plan] || subscription.plan}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`font-semibold ${statusLabel[subscription.status]?.class || ""}`}>{statusLabel[subscription.status]?.text || subscription.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor mensal</p>
              <p className="font-semibold">{fmt(subscription.price_cents)}</p>
            </div>
            {subscription.trial_ends_at && subscription.status === "trial" && (
              <div>
                <p className="text-xs text-muted-foreground">Trial expira em</p>
                <p className="font-semibold">{new Date(subscription.trial_ends_at).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
            {subscription.current_period_end && (
              <div>
                <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                <p className="font-semibold">{new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly bar chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Uso mensal (últimos 6 meses)
          </h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="Documentos" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chats" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Outros" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Pie chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Distribuição por tipo
          </h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Payments */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CreditCard className="h-4.5 w-4.5 text-muted-foreground" /> Histórico de Pagamentos</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum pagamento registrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Gateway</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-medium">{fmt(p.amount_cents)}</td>
                      <td className="px-4 py-3 capitalize">{p.gateway?.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "paid" || p.status === "approved" ? "bg-success/10 text-success" : p.status === "pending" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                          {p.status === "paid" || p.status === "approved" ? <CheckCircle className="h-3 w-3" /> : p.status === "pending" ? <Clock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Activity Log */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Calendar className="h-4.5 w-4.5 text-muted-foreground" /> Atividade Recente</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma atividade registrada</div>
          ) : (
            logs.slice(0, 30).map((log, i) => (
              <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between border-b border-border last:border-b-0 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{log.action}</p>
                  {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
