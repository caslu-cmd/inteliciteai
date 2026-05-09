import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  MessageSquare, FileText, Search, Scale, ArrowRight, CheckSquare,
  Calculator, BookMarked, Loader2, TrendingUp, Clock, Zap,
  FolderOpen, BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  documents: number;
  chats: number;
  recentDocs: { id: string; titulo: string; tipo: string; updated_at: string }[];
}

const quickActions = [
  { title: "Criar ETP", description: "Estudo Técnico Preliminar", icon: FileText, path: "/dashboard/etp", color: "bg-accent/10 text-accent", border: "hover:border-accent/30" },
  { title: "Criar TR", description: "Termo de Referência", icon: FileText, path: "/dashboard/tr", color: "bg-primary/10 text-primary", border: "hover:border-primary/30" },
  { title: "Validar Edital", description: "Conformidade Lei 14.133", icon: Search, path: "/dashboard/validator", color: "bg-success/10 text-success", border: "hover:border-success/30" },
  { title: "Chat com IA", description: "Consulte a Lei 14.133", icon: MessageSquare, path: "/dashboard/chat", color: "bg-accent/10 text-accent", border: "hover:border-accent/30" },
  { title: "Diagnóstico", description: "Identifique a modalidade", icon: Scale, path: "/dashboard/diagnostic", color: "bg-amber-500/10 text-amber-500", border: "hover:border-amber-500/30" },
  { title: "Checklist", description: "Conformidade do processo", icon: CheckSquare, path: "/dashboard/checklist", color: "bg-primary/10 text-primary", border: "hover:border-primary/30" },
  { title: "Cotação", description: "Pesquisa de preços", icon: Calculator, path: "/dashboard/quotation", color: "bg-success/10 text-success", border: "hover:border-success/30" },
  { title: "Notebook IA", description: "Base de conhecimento", icon: BookMarked, path: "/dashboard/notebook", color: "bg-amber-500/10 text-amber-500", border: "hover:border-amber-500/30" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const tipoLabel: Record<string, string> = { etp: "ETP", tr: "TR" };
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 1) return "Agora mesmo";
  if (diffH < 24) return `${Math.floor(diffH)}h atrás`;
  if (diffH < 48) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export default function DashboardHome() {
  const [userName, setUserName] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [stats, setStats] = useState<Stats>({ documents: 0, chats: 0, recentDocs: [] });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.email?.split("@")[0] || "";
      setUserName(name);
      setLoadingUser(false);
    });
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const [docsRes, chatsRes, recentRes] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("chat_conversations").select("id", { count: "exact", head: true }),
        supabase.from("documents")
          .select("id, titulo, tipo, updated_at")
          .order("updated_at", { ascending: false })
          .limit(4),
      ]);
      setStats({
        documents: docsRes.count || 0,
        chats: chatsRes.count || 0,
        recentDocs: recentRes.data || [],
      });
    } catch {
      // silent — stats are non-critical
    } finally {
      setLoadingStats(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const kpis = [
    { label: "Documentos gerados", value: stats.documents, icon: FileText, color: "text-accent", bg: "bg-accent/10" },
    { label: "Conversas com IA", value: stats.chats, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
    { label: "Ferramentas disponíveis", value: quickActions.length, icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Relatórios e análises", value: "→", icon: BarChart3, color: "text-success", bg: "bg-success/10", link: "/dashboard/reports" },
  ];

  return (
    <div className="max-w-6xl space-y-8">
      {/* Greeting */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
        <h1 className="text-2xl font-bold">
          {loadingUser ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </span>
          ) : (
            `${greeting()}${userName ? `, ${userName.split(" ")[0]}` : ""}!`
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Plataforma do Agente Público — Lei 14.133/2021
        </p>
      </motion.div>

      {/* KPIs */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const card = (
              <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 group hover:border-accent/20 transition-colors">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingStats && typeof kpi.value === "number" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                </div>
              </div>
            );
            return kpi.link ? (
              <Link key={kpi.label} to={kpi.link}>{card}</Link>
            ) : (
              <div key={kpi.label}>{card}</div>
            );
          })}
        </div>
      </motion.div>

      {/* Quick actions + Recent docs */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso rápido</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action, i) => (
              <motion.div key={action.title} initial="hidden" animate="visible" variants={fadeUp} custom={i + 3}>
                <Link
                  to={action.path}
                  className={`group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all ${action.border} hover:shadow-sm`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.color}`}>
                    <action.icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{action.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent documents */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recentes</h2>
            <Link to="/dashboard/documents" className="text-xs text-accent hover:underline">Ver todos</Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loadingStats ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : stats.recentDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum documento ainda</p>
                <Link to="/dashboard/etp" className="mt-2 text-xs text-accent hover:underline">
                  Criar primeiro ETP →
                </Link>
              </div>
            ) : (
              <div>
                {stats.recentDocs.map((doc, i) => (
                  <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors ${i < stats.recentDocs.length - 1 ? "border-b border-border" : ""}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold
                      ${doc.tipo === "etp" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                      {tipoLabel[doc.tipo] || doc.tipo.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.titulo}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {fmtDate(doc.updated_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <Link to="/dashboard/documents"
                  className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground hover:text-accent transition-colors border-t border-border">
                  <TrendingUp className="h-3.5 w-3.5" /> Ver todos os documentos
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Legal foundation banner */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={12}>
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Scale className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Nova Lei de Licitações</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Todas as ferramentas são fundamentadas na <strong>Lei 14.133/2021</strong>.
              Validade legal garantida em ETP, TR, Checklist e Diagnóstico de Modalidade.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
