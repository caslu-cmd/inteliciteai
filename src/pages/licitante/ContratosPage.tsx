import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Calendar, AlertTriangle, Plus, ChevronRight, Clock, DollarSign, Building2 } from "lucide-react";

const contracts = [
  { id: "CT-2025-001", title: "Fornecimento de Equipamentos de TI",         organ: "Ministério da Saúde",          value: 2450000, startDate: "15/01/2025", endDate: "14/01/2026", status: "vigente"  as const, progress: 35,  nextMilestone: "Entrega parcial - Lote 2",    nextDate: "15/04/2026", pendingAddendums: 0 },
  { id: "CT-2025-002", title: "Serviços de Consultoria em Segurança",        organ: "TJSP",                         value:  890000, startDate: "01/03/2025", endDate: "28/02/2026", status: "vigente"  as const, progress: 22,  nextMilestone: "Relatório mensal",             nextDate: "01/04/2026", pendingAddendums: 1 },
  { id: "CT-2024-015", title: "Manutenção de Infraestrutura de Rede",        organ: "Prefeitura de Belo Horizonte", value:  560000, startDate: "01/06/2024", endDate: "31/05/2025", status: "vencendo" as const, progress: 88,  nextMilestone: "Renovação ou encerramento",    nextDate: "31/05/2025", pendingAddendums: 2 },
  { id: "CT-2024-008", title: "Licenças de Software Microsoft",              organ: "Governo do Estado do PR",      value: 1200000, startDate: "15/03/2024", endDate: "14/03/2025", status: "encerrado" as const, progress: 100, nextMilestone: "—",                            nextDate: "—",          pendingAddendums: 0 },
];

const statusConfig = {
  vigente:   { label: "Vigente",   class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  vencendo:  { label: "Vencendo",  class: "bg-amber-400/10 text-amber-400 border-amber-400/20"       },
  encerrado: { label: "Encerrado", class: "bg-muted text-muted-foreground border-border"              },
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 16, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

export default function ContratosPage() {
  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Gestão de Contratos</h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe contratos, aditivos e fiscalizações</p>
          </div>
          <Button className="gap-2 flex-shrink-0"><Plus className="w-4 h-4" /> Novo Contrato</Button>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
          {[
            { label: "Contratos Vigentes",     value: "12",       icon: FileCheck,    color: "text-emerald-500"    },
            { label: "Valor Total Ativo",       value: "R$ 8.4M",  icon: DollarSign,   color: "text-primary"        },
            { label: "Vencendo em 30 dias",     value: "3",        icon: Clock,        color: "text-amber-400"      },
            { label: "Aditivos Pendentes",      value: "5",        icon: AlertTriangle, color: "text-destructive"   },
          ].map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
          {contracts.map((contract) => (
            <motion.div key={contract.id} variants={itemVariants}
              className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono-legal text-muted-foreground">{contract.id}</span>
                    <Badge variant="outline" className={statusConfig[contract.status].class}>{statusConfig[contract.status].label}</Badge>
                    {contract.pendingAddendums > 0 && (
                      <Badge variant="outline" className="bg-amber-400/10 text-amber-400 border-amber-400/20 text-xs">
                        {contract.pendingAddendums} aditivo(s)
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-card-foreground">{contract.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.organ}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{contract.startDate} → {contract.endDate}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(contract.value)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Execução</span>
                      <span className="font-medium text-card-foreground">{contract.progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${contract.progress}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${contract.progress >= 80 ? "bg-amber-400" : "bg-primary"}`}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 flex-shrink-0">
                    Detalhes <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {contract.status !== "encerrado" && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Próximo marco: <span className="text-card-foreground font-medium">{contract.nextMilestone}</span> — {contract.nextDate}</span>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </LicitanteLayout>
  );
}
