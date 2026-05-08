import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, Calendar, FileText, TrendingUp, PieChart, Target, Clock } from "lucide-react";

const reports = [
  { title: "Desempenho Mensal",           description: "Resumo de licitações analisadas, scores e taxa de sucesso",             icon: TrendingUp, period: "Mar 2026",  generated: "17 Mar 2026", format: "PDF"  },
  { title: "Análise de Riscos",           description: "Panorama dos riscos identificados por categoria e edital",              icon: Target,     period: "Q1 2026",   generated: "15 Mar 2026", format: "PDF"  },
  { title: "Status Documental",           description: "Documentos válidos, pendentes e vencidos com timeline",                 icon: FileText,   period: "Mar 2026",  generated: "17 Mar 2026", format: "XLSX" },
  { title: "Oportunidades por Segmento", description: "Distribuição de oportunidades por segmento e região",                   icon: PieChart,   period: "Q1 2026",   generated: "10 Mar 2026", format: "PDF"  },
];

const metrics = [
  { label: "Licitações Analisadas",   value: "47",    change: "+12%",  period: "vs. mês anterior" },
  { label: "Taxa de Participação",    value: "68%",   change: "+5%",   period: "vs. mês anterior" },
  { label: "Score Médio",             value: "64%",   change: "+3pp",  period: "vs. mês anterior" },
  { label: "Tempo Médio de Análise",  value: "4.2min", change: "-18%", period: "vs. mês anterior" },
];

export default function RelatoriosPage() {
  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Relatórios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Métricas e exportações estratégicas</p>
          </div>
          <Button className="gap-2"><FileText className="w-4 h-4" /> Gerar Relatório</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, i) => (
            <motion.div key={metric.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl border border-border p-4 shadow-card">
              <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
              <p className="text-2xl font-display font-bold text-card-foreground">{metric.value}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs font-semibold text-success">{metric.change}</span>
                <span className="text-xs text-muted-foreground">{metric.period}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card mb-6">
          <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Evolução de Análises e Score</h3>
          <div className="h-48 flex items-end gap-2 px-4">
            {[35, 42, 28, 55, 47, 62, 38, 71, 45, 58, 67, 52].map((h, i) => (
              <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: i * 0.05, duration: 0.5 }}
                className="flex-1 rounded-t-md bg-primary/20 hover:bg-primary/40 transition-colors relative group">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono-legal text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {h}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between px-4 mt-2">
            <span className="text-[10px] text-muted-foreground">Jan</span>
            <span className="text-[10px] text-muted-foreground">Dez</span>
          </div>
        </div>

        <h3 className="font-display font-semibold text-base text-foreground mb-4">Relatórios Gerados</h3>
        <div className="space-y-3">
          {reports.map((report, i) => {
            const Icon = report.icon;
            return (
              <motion.div key={report.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-card-foreground">{report.title}</h4>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{report.period}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{report.generated}</span>
                    <span className="font-mono-legal">{report.format}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" /> Exportar
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </LicitanteLayout>
  );
}
