import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, FileText, FolderOpen, Search, Scale, CheckSquare,
  Calculator, BarChart3, CreditCard, Settings, Shield, LogOut,
  ChevronLeft, ChevronRight, Bell } from
"lucide-react";
import { useState, useEffect } from "react";
import logoWhite from "@/assets/logo-white.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const navGroups = [
{
  label: "Principal",
  items: [
  { title: "Dashboard", icon: BarChart3, path: "/dashboard" },
  { title: "Assistente Jurídico", icon: MessageSquare, path: "/dashboard/chat" },
  { title: "Meus Documentos", icon: FolderOpen, path: "/dashboard/documents" }]

},
{
  label: "Geradores",
  items: [
  { title: "Gerador de ETP", icon: FileText, path: "/dashboard/etp" },
  { title: "Gerador de TR", icon: FileText, path: "/dashboard/tr" },
  { title: "Checklist", icon: CheckSquare, path: "/dashboard/checklist" }]

},
{
  label: "Ferramentas",
  items: [
  { title: "Diagnóstico", icon: Scale, path: "/dashboard/diagnostic" },
  { title: "Validador de Editais", icon: Search, path: "/dashboard/validator" },
  { title: "Cotação Inteligente", icon: Calculator, path: "/dashboard/quotation" }]

},
{
  label: "Conta",
  items: [
  { title: "Relatórios", icon: BarChart3, path: "/dashboard/reports" },
  { title: "Billing", icon: CreditCard, path: "/dashboard/billing" },
  { title: "Configurações", icon: Settings, path: "/dashboard/settings" }]

}];


export default function DashboardLayout({ children }: {children: React.ReactNode;}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {navigate("/login");return;}

      const [profileRes, subRes, notifRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
      supabase.from("notifications").select("*").eq("user_id", user.id).eq("read", false).order("created_at", { ascending: false }).limit(5)]
      );
      setProfile(profileRes.data);
      setSubscription(subRes.data);
      setNotifications(notifRes.data || []);
      setIsAdmin(await checkIsAdmin());
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const markNotificationsRead = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length > 0) {
      await supabase.from("notifications").update({ read: true }).in("id", ids);
      setNotifications([]);
    }
  };

  const getTrialInfo = () => {
    if (!subscription) return null;
    if (subscription.status === "trial" && subscription.trial_ends_at) {
      const days = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      return { text: `Trial — ${days} dias restantes`, class: days <= 2 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success" };
    }
    if (subscription.status === "active") return { text: "Plano ativo", class: "bg-success/10 text-success" };
    if (subscription.status === "blocked") return { text: "Conta bloqueada", class: "bg-destructive/10 text-destructive" };
    return null;
  };

  const trialInfo = getTrialInfo();
  const userInitial = profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}>

        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <img src={logoWhite} alt="Intelicite" className="h-8 shrink-0" />
          {!collapsed &&
          <span className="text-lg font-bold text-sidebar-foreground">
              Inteli<span className="text-gradient-gold">cite</span>
            </span>
          }
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navGroups.map((group) =>
          <div key={group.label} className="mb-4">
              {!collapsed &&
            <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </p>
            }
              {group.items.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ?
                    "bg-sidebar-accent text-sidebar-primary" :
                    "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={collapsed ? item.title : undefined}>

                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>);

            })}
            </div>
          )}

          {/* Admin link */}
          {isAdmin &&
          <div className="mb-4">
              {!collapsed &&
            <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Admin</p>
            }
              <Link
              to="/admin"
              className={cn(
                "mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                location.pathname === "/admin" ?
                "bg-sidebar-accent text-sidebar-primary" :
                "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
              title={collapsed ? "Admin" : undefined}>

                <Shield className="h-4.5 w-4.5 shrink-0" />
                {!collapsed && <span>Painel Admin</span>}
              </Link>
            </div>
          }
        </nav>

        {/* Logout & Collapse */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">

            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">

            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 transition-all duration-300", collapsed ? "ml-16" : "ml-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-lg px-6">
          <div />
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors" onClick={markNotificationsRead}>
                  <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                  {notifications.length > 0 &&
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                  }
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <p className="font-semibold text-sm mb-2">Notificações</p>
                {notifications.length === 0 ?
                <p className="text-xs text-muted-foreground">Nenhuma notificação</p> :

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n) =>
                  <div key={n.id} className="rounded-lg bg-secondary/50 p-2">
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground">{n.message}</p>
                      </div>
                  )}
                  </div>
                }
              </PopoverContent>
            </Popover>

            {trialInfo &&
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", trialInfo.class)}>
                {trialInfo.text}
              </div>
            }
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {userInitial}
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>);

}