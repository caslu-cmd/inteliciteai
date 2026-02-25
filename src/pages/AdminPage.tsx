import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Shield, BarChart3, Search, Ban, CheckCircle2, Eye, TrendingUp,
  CreditCard, FileText, Activity, Plus, Tag, MapPin, UserPlus, AlertTriangle,
  Settings, DollarSign, UserCheck, UserX, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminMetricsTab from "@/components/admin/AdminMetricsTab";
import AdminLogsTab from "@/components/admin/AdminLogsTab";
import AdminCouponsTab from "@/components/admin/AdminCouponsTab";
import AdminSalesTab from "@/components/admin/AdminSalesTab";
import AdminGeoTab from "@/components/admin/AdminGeoTab";
import AdminGatewayTab from "@/components/admin/AdminGatewayTab";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: BarChart3 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "sales", label: "Vendas", icon: CreditCard },
  { id: "gateway", label: "Gateway", icon: Settings },
  { id: "coupons", label: "Cupons", icon: Tag },
  { id: "geo", label: "Localização", icon: MapPin },
  { id: "logs", label: "Logs", icon: Activity },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [kpis, setKpis] = useState({
    totalUsers: 0,
    activeUsers: 0,
    trialUsers: 0,
    overdueUsers: 0,
    blockedUsers: 0,
    totalRevenue: 0,
    paidUsers: 0,
    monthlyRevenue: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkIsAdmin().then((admin) => {
      setIsAdmin(admin);
      if (!admin) {
        toast({ title: "Acesso negado", description: "Você não tem permissão de administrador.", variant: "destructive" });
        navigate("/dashboard");
      }
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: subs } = await supabase.from("subscriptions").select("*");
      const { data: payments } = await supabase.from("payments").select("amount_cents, status, created_at").eq("status", "paid");

      const activeUsers = subs?.filter((s: any) => s.status === "active").length || 0;
      const trialUsers = subs?.filter((s: any) => s.status === "trial").length || 0;
      const overdueUsers = subs?.filter((s: any) => s.status === "overdue").length || 0;
      const blockedUsers = subs?.filter((s: any) => s.status === "blocked").length || 0;
      const paidUsers = subs?.filter((s: any) => s.status === "active" && s.price_cents > 0).length || 0;
      const totalRevenue = payments?.reduce((sum: number, p: any) => sum + p.amount_cents, 0) || 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthlyRevenue = payments
        ?.filter((p: any) => p.created_at >= monthStart)
        .reduce((sum: number, p: any) => sum + p.amount_cents, 0) || 0;

      setKpis({
        totalUsers: totalUsers || 0,
        activeUsers,
        trialUsers,
        overdueUsers,
        blockedUsers,
        totalRevenue,
        paidUsers,
        monthlyRevenue,
      });
    })();
  }, [isAdmin]);

  if (isAdmin === null) return <div className="flex items-center justify-center py-32"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!isAdmin) return null;

  const kpiCards = [
    { label: "Total de Usuários", value: kpis.totalUsers.toString(), icon: Users, color: "text-accent", bg: "bg-accent/10" },
    { label: "Ativos (Pagos)", value: kpis.paidUsers.toString(), icon: UserCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Em Trial", value: kpis.trialUsers.toString(), icon: Clock, color: "text-accent", bg: "bg-accent/10" },
    { label: "Inadimplentes", value: kpis.overdueUsers.toString(), icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Bloqueados", value: kpis.blockedUsers.toString(), icon: UserX, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Receita do Mês", value: `R$ ${(kpis.monthlyRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
    { label: "Receita Total", value: `R$ ${(kpis.totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: CreditCard, color: "text-success", bg: "bg-success/10" },
    { label: "Assinantes Ativos", value: kpis.activeUsers.toString(), icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <div className="max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento completo da plataforma</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 rounded-lg bg-secondary p-1 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* KPI Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            {kpiCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", card.bg)}>
                    <card.icon className={cn("h-4 w-4", card.color)} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick summary cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-accent" />
                Planos Disponíveis
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">Gratuito (Trial)</p>
                    <p className="text-xs text-muted-foreground">7 dias de teste</p>
                  </div>
                  <span className="text-sm font-bold">R$ 0</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <div>
                    <p className="text-sm font-medium">Profissional</p>
                    <p className="text-xs text-muted-foreground">Todos os recursos</p>
                  </div>
                  <span className="text-sm font-bold text-accent">R$ 297/mês</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Atenção Necessária
              </h3>
              <div className="space-y-2">
                {kpis.overdueUsers > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <DollarSign className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">{kpis.overdueUsers} inadimplente{kpis.overdueUsers > 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">Pagamentos em atraso</p>
                    </div>
                  </div>
                )}
                {kpis.trialUsers > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <Clock className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-medium">{kpis.trialUsers} em trial</p>
                      <p className="text-xs text-muted-foreground">Aguardando conversão</p>
                    </div>
                  </div>
                )}
                {kpis.overdueUsers === 0 && kpis.trialUsers === 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-muted-foreground">Nenhum problema encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Admin info */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium">Sua conta é vitalícia</p>
              <p className="text-xs text-muted-foreground">Como administrador, você possui acesso completo e permanente sem nenhum custo.</p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "users" && <AdminUsersTab />}
      {activeTab === "sales" && <AdminSalesTab />}
      {activeTab === "gateway" && <AdminGatewayTab />}
      {activeTab === "coupons" && <AdminCouponsTab />}
      {activeTab === "geo" && <AdminGeoTab />}
      {activeTab === "logs" && <AdminLogsTab />}
    </div>
  );
}
