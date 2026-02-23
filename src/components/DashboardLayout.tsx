import { Link, useLocation } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  FolderOpen,
  Search,
  Scale,
  CheckSquare,
  Calculator,
  BarChart3,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", icon: BarChart3, path: "/dashboard" },
      { title: "Assistente Jurídico", icon: MessageSquare, path: "/dashboard/chat" },
      { title: "Meus Documentos", icon: FolderOpen, path: "/dashboard/documents" },
    ],
  },
  {
    label: "Geradores",
    items: [
      { title: "Gerador de ETP", icon: FileText, path: "/dashboard/etp" },
      { title: "Gerador de TR", icon: FileText, path: "/dashboard/tr" },
      { title: "Checklist", icon: CheckSquare, path: "/dashboard/checklist" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Diagnóstico", icon: Scale, path: "/dashboard/diagnostic" },
      { title: "Validador de Editais", icon: Search, path: "/dashboard/validator" },
      { title: "Cotação Inteligente", icon: Calculator, path: "/dashboard/quotation" },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Relatórios", icon: BarChart3, path: "/dashboard/reports" },
      { title: "Billing", icon: CreditCard, path: "/dashboard/billing" },
      { title: "Configurações", icon: Settings, path: "/dashboard/settings" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <Shield className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">
              Inteli<span className="text-sidebar-primary">cite</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 transition-all duration-300", collapsed ? "ml-16" : "ml-64")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-lg px-6">
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              Trial ativo — 7 dias restantes
            </div>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
              U
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
