import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, LayoutDashboard, Briefcase, Target, ChevronUp } from "lucide-react";
import { checkIsAdmin } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

const AREAS = [
  { to: "/admin",     label: "Super Admin", icon: Shield,          match: (p: string) => p.startsWith("/admin") },
  { to: "/dashboard", label: "Agente",      icon: LayoutDashboard, match: (p: string) => p.startsWith("/dashboard") },
  { to: "/consultor", label: "Consultor",   icon: Briefcase,       match: (p: string) => p.startsWith("/consultor") },
  { to: "/licitante", label: "Licitante",   icon: Target,          match: (p: string) => p.startsWith("/licitante") },
];

export default function AdminSwitcher() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => { checkIsAdmin().then(setIsAdmin); }, []);
  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1 rounded-xl border border-emerald-400/30 bg-[#080D14]/95 backdrop-blur p-1.5 shadow-2xl shadow-emerald-400/10">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400/70">Trocar área</p>
          {AREAS.map((a) => {
            const Icon = a.icon;
            const active = a.match(pathname);
            return (
              <Link key={a.to} to={a.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  active ? "bg-emerald-400/15 text-emerald-400" : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                )}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{a.label}</span>
              </Link>
            );
          })}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-[#080D14] shadow-lg shadow-emerald-400/30 hover:scale-105 transition-transform"
        title="Trocar área (admin)">
        {open ? <ChevronUp className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
      </button>
    </div>
  );
}
