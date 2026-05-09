import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Radar, FileSearch, ScanLine, Building2,
  FolderCheck, FileText, MessageSquareText, BarChart3,
  ChevronLeft, ChevronRight, DollarSign, FileCheck,
  LogOut, Scale, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const NAV_MAIN = [
  { to: "/licitante",           icon: LayoutDashboard,   label: "Dashboard"     },
  { to: "/licitante/radar",     icon: Radar,             label: "Radar"         },
  { to: "/licitante/analises",  icon: FileSearch,        label: "Análises"      },
  { to: "/licitante/scanner",   icon: ScanLine,          label: "Scanner"       },
  { to: "/licitante/habilitacao", icon: Building2,       label: "Habilitação"   },
  { to: "/licitante/documentos",  icon: FolderCheck,     label: "Documentos"    },
  { to: "/licitante/minutas",   icon: FileText,          label: "Minutas"       },
  { to: "/licitante/assistente", icon: MessageSquareText, label: "Assistente IA" },
  { to: "/licitante/relatorios", icon: BarChart3,        label: "Relatórios"    },
];

const NAV_ESTRATEGIA = [
  { to: "/licitante/precificacao", icon: DollarSign,  label: "Precificação" },
  { to: "/licitante/contratos",    icon: FileCheck,   label: "Contratos"    },
];

function NavItem({ item, collapsed, exact, onNavigate }: { item: typeof NAV_MAIN[0]; collapsed: boolean; exact?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  return (
    <NavLink
      to={item.to}
      end={exact}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
        isActive ? "text-white" : "text-muted-foreground hover:text-white"
      )}
      style={{ background: isActive ? "hsl(var(--sidebar-accent))" : "transparent" }}
    >
      {isActive && (
        <motion.div
          layoutId="licitante-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ background: "hsl(var(--sidebar-primary))" }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}

export function LicitanteLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const SidebarBody = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(265 80% 55%)" }}>
            <Scale className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-display font-semibold text-base" style={{ color: "hsl(var(--sidebar-accent-foreground))" }}>
                  Intelicite
                </span>
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "hsl(265 80% 55% / 0.2)", color: "hsl(265 80% 75%)" }}>
                  Licitante
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map((item, i) => (
          <NavItem key={item.to} item={item} collapsed={collapsed && !isMobile} exact={i === 0} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />
        ))}

        <div className="pt-3 pb-1 px-3">
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "hsl(var(--sidebar-foreground) / 0.35)" }}
              >
                Estratégia
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && !isMobile && <div className="h-px" style={{ background: "hsl(var(--sidebar-border))" }} />}
        </div>

        {NAV_ESTRATEGIA.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed && !isMobile} onNavigate={isMobile ? () => setMobileOpen(false) : undefined} />
        ))}
      </nav>

      <div className="py-3 px-2 border-t space-y-0.5" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            {collapsed ? <ChevronRight className="w-5 h-5 flex-shrink-0" /> : <ChevronLeft className="w-5 h-5 flex-shrink-0" />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  Recolher
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col overflow-hidden"
        style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        <SidebarBody />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col md:hidden"
              style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
            >
              <SidebarBody isMobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main
        className={cn(
          "flex-1 transition-[margin] duration-250 min-w-0",
          collapsed ? "md:ml-[72px]" : "md:ml-64"
        )}
      >
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-3 px-4 border-b backdrop-blur"
          style={{ background: "hsl(var(--background) / 0.85)", borderColor: "hsl(var(--border))" }}>
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "hsl(265 80% 55%)" }}>
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-semibold text-sm">Intelicite Licitante</span>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
