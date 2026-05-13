import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, FileText, FolderOpen, Search, Scale, CheckSquare,
  Calculator, BarChart3, CreditCard, Settings, Shield, LogOut,
  ChevronLeft, ChevronRight, Bell, BookMarked, LayoutDashboard,
  Zap, ChevronDown, Command, Layers, ArrowLeft, Briefcase, Plus,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import logoWhite from "@/assets/logo-white.png";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import CommandPalette from "@/components/CommandPalette";

// ── Nav structure ─────────────────────────────────────────────
const NAV = [
  {
    items: [
      { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
      { title: "Assistente IA",   icon: MessageSquare,   path: "/dashboard/chat" },
      { title: "Notebook IA",     icon: BookMarked,      path: "/dashboard/notebook", badge: "Novo" },
      { title: "Documentos",      icon: FolderOpen,      path: "/dashboard/documents" },
    ],
  },
  {
    label: "Geradores",
    items: [
      { title: "Gerador de DFD",  icon: FileText,  path: "/dashboard/dfd", badge: "Novo" },
      { title: "Gerador de ETP",  icon: FileText,  path: "/dashboard/etp" },
      { title: "Gerador de TR",   icon: FileText,  path: "/dashboard/tr" },
      { title: "Checklist",       icon: CheckSquare, path: "/dashboard/checklist" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Diagnóstico",     icon: Scale,      path: "/dashboard/diagnostic" },
      { title: "Validador",       icon: Search,     path: "/dashboard/validator" },
      { title: "Cotação",         icon: Calculator, path: "/dashboard/quotation" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { title: "Publicar Projeto", icon: Plus,      path: "/dashboard/publicar-projeto", badge: "Novo" },
      { title: "Meus Projetos",    icon: Briefcase, path: "/dashboard/meus-projetos" },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Relatórios",      icon: BarChart3,  path: "/dashboard/reports" },
      { title: "Billing",         icon: CreditCard, path: "/dashboard/billing" },
      { title: "Configurações",   icon: Settings,   path: "/dashboard/settings" },
    ],
  },
];

// ── Page titles ───────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/chat": "Assistente Jurídico",
  "/dashboard/notebook": "Notebook IA",
  "/dashboard/documents": "Meus Documentos",
  "/dashboard/dfd": "Gerador de DFD",
  "/dashboard/etp": "Gerador de ETP",
  "/dashboard/tr": "Gerador de TR",
  "/dashboard/checklist": "Checklist",
  "/dashboard/diagnostic": "Diagnóstico de Modalidade",
  "/dashboard/validator": "Validador de Editais",
  "/dashboard/quotation": "Cotação Inteligente",
  "/dashboard/publicar-projeto": "Publicar Projeto",
  "/dashboard/meus-projetos": "Meus Projetos",
  "/dashboard/reports": "Relatórios",
  "/dashboard/billing": "Billing",
  "/dashboard/settings": "Configurações",
  "/admin": "Super Admin",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const [profileRes, subRes, notifRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
        supabase.from("notifications").select("*").eq("user_id", user.id).eq("read", false)
          .order("created_at", { ascending: false }).limit(5),
      ]);
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

  const getTrialDays = () => {
    if (!subscription || subscription.status !== "trial" || !subscription.trial_ends_at) return null;
    return Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000));
  };

  const trialDays = getTrialDays();
  const planLabel =
    subscription?.status === "active" ? "Pro" :
    subscription?.status === "trial" ? `Trial · ${trialDays}d` :
    subscription?.status === "blocked" ? "Bloqueado" : "Free";
  const planColor =
    subscription?.status === "active" ? "text-emerald-400" :
    subscription?.status === "trial" ? "text-amber-400" :
    subscription?.status === "blocked" ? "text-red-400" : "text-muted-foreground";

  const userInitials = (profile?.full_name || profile?.email || "U")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const pageTitle = PAGE_TITLES[location.pathname] || "";

  // ── Sidebar content ───────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 border-b transition-all duration-300",
          collapsed ? "h-14 justify-center" : "h-14"
        )}
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden">
          <img src={logoWhite} alt="Intelicite" className="h-full w-full object-contain" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="text-sm font-bold tracking-tight" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
                Intelicite
              </span>
              <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded"
                style={{ background: "hsl(var(--sidebar-primary) / 0.15)", color: "hsl(var(--sidebar-primary))" }}>
                AI
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2 scrollbar-thin">
        {NAV.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "pt-3" : ""}>
            {/* Section label */}
            {group.label && !collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "hsl(var(--sidebar-foreground) / 0.35)" }}>
                {group.label}
              </p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="mx-3 mb-2 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }} />
            )}
            {group.items.map((item) => {
              const isAdminDash = item.path === "/dashboard" && isAdmin;
              const displayItem = isAdminDash
                ? { title: "Admin", icon: Shield, path: "/admin", badge: undefined }
                : item;
              const active = location.pathname === displayItem.path;

              return (
                <Link
                  key={displayItem.path}
                  to={displayItem.path}
                  title={collapsed ? displayItem.title : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    active
                      ? "text-white"
                      : "hover:text-white"
                  )}
                  style={{
                    color: active ? "white" : "hsl(var(--sidebar-foreground))",
                    background: active ? "hsl(var(--sidebar-accent))" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "hsl(var(--sidebar-accent) / 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: "hsl(var(--sidebar-primary))" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <displayItem.icon
                    className="h-4 w-4 shrink-0 transition-colors"
                    style={{ color: active ? "hsl(var(--sidebar-primary))" : "hsl(var(--sidebar-foreground) / 0.7)" }}
                  />

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="truncate"
                      >
                        {displayItem.title}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Badge */}
                  {!collapsed && (displayItem as any).badge && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "hsl(var(--sidebar-primary) / 0.15)", color: "hsl(var(--sidebar-primary))" }}>
                      {(displayItem as any).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Platform switcher — admin only */}
      {isAdmin && (
        <div className="shrink-0 border-t px-2 pt-3 pb-1" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "hsl(var(--sidebar-foreground) / 0.35)" }}>
              Plataformas
            </p>
          )}
          {collapsed && <div className="mx-3 mb-2 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }} />}
          {[
            { label: "Agente Público", path: "/dashboard", emoji: "🏛️" },
            { label: "Licitante",  path: "/licitante",  emoji: "📋" },
            { label: "Consultor",  path: "/consultor",  emoji: "🎓" },
          ].map(({ label, path, emoji }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + "/");
            return (
              <Link key={path} to={path} title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                  active ? "text-white" : "hover:text-white"
                )}
                style={{
                  color: active ? "white" : "hsl(var(--sidebar-foreground))",
                  background: active ? "hsl(var(--sidebar-accent))" : "transparent",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "hsl(var(--sidebar-accent) / 0.5)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="text-sm shrink-0">{emoji}</span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="truncate">
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </div>
      )}

      {/* Bottom: plan + user */}
      <div className="shrink-0 border-t px-2 py-3 space-y-1"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}>

        {/* Plan badge */}
        {!collapsed && subscription && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
            style={{ background: "hsl(var(--sidebar-accent) / 0.4)" }}>
            <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--sidebar-primary))" }} />
            <span className={cn("text-xs font-semibold flex-1", planColor)}>{planLabel}</span>
            {subscription.status === "trial" && (
              <Link to="/dashboard/billing" className="text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors"
                style={{ background: "hsl(var(--sidebar-primary) / 0.15)", color: "hsl(var(--sidebar-primary))" }}>
                Upgrade
              </Link>
            )}
          </div>
        )}

        {/* User */}
        <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all text-left",
                collapsed && "justify-center"
              )}
              style={{ color: "hsl(var(--sidebar-foreground))" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--sidebar-accent) / 0.5)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "hsl(var(--sidebar-primary) / 0.2)", color: "hsl(var(--sidebar-primary))" }}>
                {userInitials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
                      {profile?.full_name || "Usuário"}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>
                      {profile?.email || ""}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--sidebar-foreground) / 0.4)" }} />
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-52 p-1.5"
            side="top"
            align={collapsed ? "center" : "end"}
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <Link to="/dashboard/settings"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setUserMenuOpen(false)}>
              <Settings className="h-4 w-4 text-muted-foreground" />
              Configurações
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </PopoverContent>
        </Popover>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
          style={{ color: "hsl(var(--sidebar-foreground) / 0.4)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(var(--sidebar-foreground))")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(var(--sidebar-foreground) / 0.4)")}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full" style={{ background: "hsl(var(--background))" }}>
      {/* ── Desktop sidebar ──────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-screen w-60 flex flex-col md:hidden"
              style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ─────────────────────────────────── */}
      <div className={cn("flex flex-1 flex-col min-w-0 transition-all duration-300", collapsed ? "md:ml-16" : "md:ml-60")}>
        {/* Header */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 sm:px-6 gap-3 sm:gap-4"
          style={{
            background: "hsl(var(--background) / 0.85)",
            borderBottom: "1px solid hsl(var(--border))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Left: hamburger (mobile) + back button + page title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            {location.pathname !== "/dashboard" && location.pathname !== "/admin" && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-secondary transition-colors shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {pageTitle && (
              <h1 className="text-sm font-semibold text-foreground truncate">{pageTitle}</h1>
            )}
          </div>

          {/* Right: search hint + notifications + user */}
          <div className="flex items-center gap-2">
            {/* Cmd+K search */}
            <button
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-secondary"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar…</span>
              <kbd className="ml-2 flex items-center gap-0.5 opacity-60">
                <Command className="h-3 w-3" />
                <span>K</span>
              </kbd>
            </button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
                  onClick={markNotificationsRead}
                >
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notificações</p>
                </div>
                <div className="p-2 max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma notificação</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="rounded-lg p-3 hover:bg-secondary transition-colors">
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* User avatar */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0"
              style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}
            >
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
