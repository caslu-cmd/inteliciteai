import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Shield, BarChart3, Tag, MapPin, Activity,
  CreditCard, AlertTriangle, Settings, DollarSign,
  UserCheck, UserX, Clock, CheckCircle2, XCircle, Gift,
  TrendingUp, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminVerificationsTab from "@/components/admin/AdminVerificationsTab";
import AdminLogsTab from "@/components/admin/AdminLogsTab";
import AdminCouponsTab from "@/components/admin/AdminCouponsTab";
import AdminSalesTab from "@/components/admin/AdminSalesTab";
import AdminGeoTab from "@/components/admin/AdminGeoTab";
import AdminGatewayTab from "@/components/admin/AdminGatewayTab";

const tabs = [
  { id: "overview",       label: "Visão Geral",  icon: BarChart3 },
  { id: "users",          label: "Usuários",     icon: Users },
  { id: "verifications",  label: "Consultores",  icon: Shield },
  { id: "sales",          label: "Vendas",       icon: CreditCard },
  { id: "gateway",        label: "Gateway",      icon: Settings },
  { id: "coupons",        label: "Cupons",       icon: Tag },
  { id: "geo",            label: "Localização",  icon: MapPin },
  { id: "logs",           label: "Logs",         icon: Activity },
];

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  organization: string;
  platform_role: string;
  created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [kpis, setKpis] = useState({
    totalUsers: 0,
    paidUsers: 0,
    trialUsers: 0,
    overdueUsers: 0,
    blockedUsers: 0,
    expiredUsers: 0,
    freeUsers: 0,
    pendingUsers: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const { count: totalUsers } = await supabase
      .from("profiles").select("*", { count: "exact", head: true });

    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, email, organization, platform_role, account_status, created_at");

    const { data: subs } = await supabase.from("subscriptions").select("*");

    const { data: payments } = await supabase
      .from("payments").select("amount_cents, status, created_at").eq("status", "paid");

    const paidUsers    = subs?.filter((s: any) => s.status === "active" && s.price_cents > 0).length || 0;
    const trialUsers   = subs?.filter((s: any) => s.status === "trial").length || 0;
    const overdueUsers = subs?.filter((s: any) => s.status === "overdue").length || 0;
    const blockedUsers = subs?.filter((s: any) => s.status === "blocked").length || 0;
    const expiredUsers = subs?.filter((s: any) => s.status === "expired").length || 0;
    const freeUsers    = profiles?.filter((p: any) => p.account_status === "free").length || 0;
    const pendingCount = profiles?.filter((p: any) => p.account_status === "pending").length || 0;

    const totalRevenue = payments?.reduce((sum: number, p: any) => sum + p.amount_cents, 0) || 0;
    const monthStart   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const monthlyRevenue = payments
      ?.filter((p: any) => p.created_at >= monthStart)
      .reduce((sum: number, p: any) => sum + p.amount_cents, 0) || 0;

    setKpis({
      totalUsers: totalUsers || 0,
      paidUsers, trialUsers, overdueUsers, blockedUsers, expiredUsers,
      freeUsers, pendingUsers: pendingCount, totalRevenue, monthlyRevenue,
    });

    const pending = (profiles || [])
      .filter((p: any) => p.account_status === "pending")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPendingUsers(pending as PendingUser[]);
  }, []);

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
    fetchData();
  }, [isAdmin, fetchData]);

  const setAccountStatus = async (userId: string, status: string) => {
    await supabase.from("profiles").update({ account_status: status }).eq("id", userId);
    if (status === "free") {
      await supabase.from("subscriptions").update({ status: "active", price_cents: 0 }).eq("user_id", userId);
    }
    toast({
      title: status === "approved" ? "✓ Usuário aprovado"
           : status === "free"     ? "✓ Acesso free concedido"
           : "✗ Usuário rejeitado",
    });
    fetchData();
  };

  if (isAdmin === null) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
    </div>
  );
  if (!isAdmin) return null;

  const totalNonPending = kpis.totalUsers - kpis.pendingUsers;
  const pct = (n: number) => totalNonPending > 0 ? Math.round((n / totalNonPending) * 100) : 0;

  const statusBars = [
    { label: "Pagos",        value: kpis.paidUsers,    color: "bg-emerald-400", pct: pct(kpis.paidUsers) },
    { label: "Trial",        value: kpis.trialUsers,   color: "bg-cyan-400",    pct: pct(kpis.trialUsers) },
    { label: "Free",         value: kpis.freeUsers,    color: "bg-violet-400",  pct: pct(kpis.freeUsers) },
    { label: "Inadimplente", value: kpis.overdueUsers, color: "bg-amber-400",   pct: pct(kpis.overdueUsers) },
    { label: "Expirado",     value: kpis.expiredUsers, color: "bg-orange-400",  pct: pct(kpis.expiredUsers) },
    { label: "Bloqueado",    value: kpis.blockedUsers, color: "bg-red-500",     pct: pct(kpis.blockedUsers) },
  ];

  const ROLE_LABELS: Record<string, string> = {
    gestor: "Agente Público", licitante: "Licitante", consultor: "Consultor",
  };

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento completo da plataforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 -mx-1 overflow-x-auto">
        <div className="flex gap-1 rounded-lg bg-secondary p-1 w-max min-w-full sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "overview" && kpis.pendingUsers > 0 && (
                <span className="ml-1 bg-amber-400 text-[#080D14] rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                  {kpis.pendingUsers}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* KPI row */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            {[
              { label: "Total de Usuários",  value: kpis.totalUsers,   icon: Users,        color: "text-accent",       bg: "bg-accent/10" },
              { label: "Pagos (Ativos)",     value: kpis.paidUsers,    icon: UserCheck,    color: "text-emerald-400",  bg: "bg-emerald-400/10" },
              { label: "Em Trial",           value: kpis.trialUsers,   icon: Clock,        color: "text-cyan-400",     bg: "bg-cyan-400/10" },
              { label: "Inadimplentes",      value: kpis.overdueUsers, icon: AlertTriangle,color: "text-amber-400",    bg: "bg-amber-400/10" },
              { label: "Bloqueados/Exp.",    value: kpis.blockedUsers + kpis.expiredUsers, icon: UserX, color: "text-red-400", bg: "bg-red-400/10" },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-3", card.bg)}>
                  <card.icon className={cn("h-4 w-4", card.color)} />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Revenue + Status breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <p className="font-semibold text-sm">Receita</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Este mês</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      R$ {(kpis.monthlyRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total acumulado</p>
                    <p className="text-lg font-bold">
                      R$ {(kpis.totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">MRR estimado</p>
                  <p className="text-sm font-medium">
                    R$ {(kpis.paidUsers * 29700 / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    <span className="text-xs text-muted-foreground ml-1">({kpis.paidUsers} assinantes × R$297)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-accent" />
                <p className="font-semibold text-sm">Usuários por Status</p>
              </div>
              <div className="space-y-2.5">
                {statusBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{bar.label}</span>
                      <span className="text-xs font-semibold">{bar.value} <span className="text-muted-foreground font-normal">({bar.pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", bar.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.pct}%` }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pending approvals */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5">
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-400/10">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <p className="font-semibold text-sm">Cadastros Aguardando Aprovação</p>
                {kpis.pendingUsers > 0 && (
                  <span className="bg-amber-400 text-[#080D14] rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {kpis.pendingUsers}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveTab("users")}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-muted-foreground">Nenhum cadastro pendente</p>
              </div>
            ) : (
              <div>
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center px-4 sm:px-5 py-3 border-b border-amber-400/5 last:border-b-0 hover:bg-amber-400/[0.03] transition-colors"
                  >
                    <div className="sm:col-span-4 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="sm:col-span-3 text-xs text-muted-foreground truncate">
                      {user.organization || "—"}
                    </div>
                    <div className="sm:col-span-2 text-xs text-muted-foreground">
                      {ROLE_LABELS[user.platform_role] || user.platform_role}
                    </div>
                    <div className="sm:col-span-3 flex sm:justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Aprovar"
                        onClick={() => setAccountStatus(user.id, "approved")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Conceder Free"
                        onClick={() => setAccountStatus(user.id, "free")}
                      >
                        <Gift className="h-3.5 w-3.5 text-cyan-400" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Rejeitar"
                        onClick={() => setAccountStatus(user.id, "rejected")}
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin info */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent shrink-0" />
            <div>
              <p className="text-sm font-medium">Sua conta é vitalícia</p>
              <p className="text-xs text-muted-foreground">
                Como administrador, você possui acesso completo e permanente sem nenhum custo.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "users"          && <AdminUsersTab />}
      {activeTab === "verifications"  && <AdminVerificationsTab />}
      {activeTab === "sales"   && <AdminSalesTab />}
      {activeTab === "gateway" && <AdminGatewayTab />}
      {activeTab === "coupons" && <AdminCouponsTab />}
      {activeTab === "geo"     && <AdminGeoTab />}
      {activeTab === "logs"    && <AdminLogsTab />}
    </div>
  );
}
