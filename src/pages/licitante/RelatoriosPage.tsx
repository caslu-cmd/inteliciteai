import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Download, FileText, TrendingUp, PieChart, Target, Clock,
  Loader2, CheckCircle, AlertTriangle, FileEdit, BookOpen,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart as RechartsPie, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { exportAsPdf } from "@/lib/exportDocument";

interface Minuta {
  id: string;
  tipo: string;
  titulo: string;
  orgao: string;
  status: string;
  created_at: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success, 142 71% 45%))", "hsl(var(--muted-foreground))"];

const statusConfig: Record<string, { label: string; cls: string; icon: any }> = {
  rascunho:    { label: "Rascunho",    cls: "bg-muted/60 text-muted-foreground", icon: FileEdit },
  gerado:      { label: "Gerado",      cls: "bg-blue-500/10 text-blue-600",       icon: CheckCircle },
  assinado:    { label: "Assinado",    cls: "bg-success/10 text-success",          icon: CheckCircle },
  protocolado: { label: "Protocolado", cls: "bg-accent/10 text-accent",            icon: CheckCircle },
};

const tipoLabel: Record<string, string> = { impugnacao: "Impugnação", esclarecimento: "Esclarecimento" };

export default function RelatoriosPage() {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("minutas")
      .select("id, tipo, titulo, orgao, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setMinutas(data || []); setLoading(false); });
  }, []);

  if (loading) return (
    <LicitanteLayout>
      <div className="flex items-center justify-center py-32"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
    </LicitanteLayout>
  );

  // ── Computed stats ──
  const impugnacoes = minutas.filter(m => m.tipo === "impugnacao").length;
  const esclarecimentos = minutas.filter(m => m.tipo === "esclarecimento").length;
  const finalizadas = minutas.filter(m => m.status === "protocolado" || m.status === "assinado").length;
  const emAberto = minutas.filter(m => m.status === "rascunho" || m.status === "gerado").length;

  // Monthly minutas (last 6 months)
  const monthlyData = (() => {
    const months: Record<string, { impugnacoes: number; esclarecimentos: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })] = { impugnacoes: 0, esclarecimentos: 0 };
    }
    minutas.forEach(m => {
      const key = new Date(m.created_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (!(key in months)) return;
      if (m.tipo === "impugnacao") months[key].impugnacoes++;
      else months[key].esclarecimentos++;
    });
    return Object.entries(months).map(([name, v]) => ({ name, "Impugnações": v.impugnacoes, "Esclarecimentos": v.esclarecimentos }));
  })();

  const pieData = [
    { name: "Impugnações", value: impugnacoes },
    { name: "Esclarecimentos", value: esclarecimentos },
  ].filter(d => d.value > 0);

  const handleExport = () => {
    exportAsPdf({
      documentTitle: "Relatório de Minutas — Licitante",
      legalBasis: "Lei 14.133/2021",
      sections: [
        {
          title: "Resumo",
          isMarkdown: false,
          content: `Total de minutas: ${minutas.length}\nImpugnações: ${impugnacoes}\nEsclarecimentos: ${esclarecimentos}\nFinalizadas/Protocoladas: ${finalizadas}\nEm aberto: ${emAberto}`,
        },
        {
          title: "Minutas geradas",
          isMarkdown: false,
          content: minutas.length === 0
            ? "Nenhuma minuta registrada"
            : minutas.slice(0, 20).map(m =>
                `${new Date(m.created_at).toLocaleDateString("pt-BR")} — ${tipoLabel[m.tipo] || m.tipo} — ${m.titulo} — ${statusConfig[m.status]?.label || m.status}`
              ).join("\n"),
        },
      ],
    });
  };

  const metrics = [
    { label: "Total de Minutas",  value: minutas.length,   sub: "impugnações e esclarecimentos", icon: FileText,      color: "text-primary" },
    { label: "Impugnações",       value: impugnacoes,       sub: "geradas pela IA",               icon: AlertTriangle, color: "text-destructive" },
    { label: "Esclarecimentos",   value: esclarecimentos,   sub: "pedidos gerados",               icon: BookOpen,      color: "text-accent" },
    { label: "Finalizadas",       value: finalizadas,       sub: `${emAberto} em aberto`,          icon: CheckCircle,   color: "text-success" },
  ];

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Relatórios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Métricas e exportações estratégicas</p>
          </div>
          <Button className="gap-2" onClick={handleExport}><Download className="w-4 h-4" /> Exportar PDF</Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl border border-border p-4 shadow-card">
              <m.icon className={`h-5 w-5 ${m.color} mb-2`} />
              <p className="text-2xl font-display font-bold text-card-foreground">{m.value}</p>
              <p className="text-xs font-medium text-card-foreground mt-0.5">{m.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="font-display font-semibold text-base text-card-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Minutas por mês (últimos 6 meses)
            </h3>
            {minutas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma minuta gerada ainda</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="Impugnações" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Esclarecimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="font-display font-semibold text-base text-card-foreground mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" /> Distribuição por tipo
            </h3>
            {pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <PieChart className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Nenhuma minuta gerada ainda</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent minutas */}
        <h3 className="font-display font-semibold text-base text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" /> Minutas Recentes
        </h3>
        <div className="space-y-3">
          {minutas.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma minuta gerada ainda.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Acesse o Gerador de Minutas para criar impugnações e pedidos de esclarecimento.</p>
            </div>
          ) : (
            minutas.slice(0, 10).map((m, i) => {
              const sc = statusConfig[m.status] || { label: m.status, cls: "bg-muted text-muted-foreground", icon: FileText };
              const Icon = sc.icon;
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground truncate">{m.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>{tipoLabel[m.tipo] || m.tipo}</span>
                      {m.orgao && <><span>·</span><span className="truncate max-w-[160px]">{m.orgao}</span></>}
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0 ${sc.cls}`}>
                    <Icon className="h-3 w-3" /> {sc.label}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </LicitanteLayout>
  );
}
