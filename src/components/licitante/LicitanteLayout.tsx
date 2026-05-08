import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Radar, FileSearch, ScanLine, Building2,
  FolderCheck, FileText, MessageSquareText, BarChart3, Settings,
  ChevronLeft, ChevronRight, Zap, Swords, DollarSign, FileCheck,
  LogOut, Scale,
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

function NavItem({ item, collapsed, exact }: { item: typeof NAV_MAIN[0]; collapsed: boolean; exact?: boolean }) {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === item.to
    : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  return (
    <NavLink
      to={item.to}
      end={exact}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
        isActive
          ? "text-white"
          : "text-muted-foreground hover:text-white"
      )}
      style={({ isActive: _a }) => ({
        background: isActive ? "hsl(var(--sidebar-accent))" : "transparent",
      })}
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
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden"
        style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(265 80% 55%)" }}>
              <Scale className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
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
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_MAIN.map((item, i) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} exact={i === 0} />
          ))}

          <div className="pt-3 pb-1 px-3">
            <AnimatePresence>
              {!collapsed && (
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
            {collapsed && <div className="h-px" style={{ background: "hsl(var(--sidebar-border))" }} />}
          </div>

          {NAV_ESTRATEGIA.map((item) => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Bottom */}
        <div className="py-3 px-2 border-t space-y-0.5" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary"
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
        </div>
      </motion.aside>

      {/* Content */}
      <main
        className="flex-1 transition-[margin] duration-250"
        style={{ marginLeft: collapsed ? 72 : 256 }}
      >
        {children}
      </main>
    </div>
  );
}
