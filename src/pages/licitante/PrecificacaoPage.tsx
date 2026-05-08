import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calculator, TrendingUp, Target, Percent, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

const simulations = [
  { id: 1, title: "PE 045/2025 - Equipamentos de TI",      organ: "Ministério da Saúde",    estimatedValue: 2450000, suggestedPrice: 2180000, margin: 14.2, winProbability: 72, competitors: 5,  recommendation: "agressivo"  as const },
  { id: 2, title: "Concorrência 012/2025 - Consultoria SI", organ: "TJSP",                   estimatedValue:  890000, suggestedPrice:  845000, margin: 22.5, winProbability: 58, competitors: 8,  recommendation: "moderado"   as const },
  { id: 3, title: "PP 078/2025 - Licenças Software",       organ: "Prefeitura de Curitiba", estimatedValue: 1200000, suggestedPrice: 1150000, margin:  8.3, winProbability: 41, competitors: 12, recommendation: "conservador" as const },
];

const recColors  = { agressivo: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", moderado: "bg-amber-400/10 text-amber-400 border-amber-400/20", conservador: "bg-destructive/10 text-destructive border-destructive/20" };
const recLabels  = { agressivo: "Preço agressivo", moderado: "Preço moderado", conservador: "Preço conservador" };
const recDetails = {
  agressivo:   "Oportunidade com alta chance. Preço agressivo para maximizar vitória.",
  moderado:    "Equilibrar margem e competitividade. Monitorar concorrência.",
  conservador: "Foco na margem. Alta competição reduz chances com preço elevado.",
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 16, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

export default function PrecificacaoPage() {
  const [selectedSim, setSelectedSim] = useState<number | null>(null);

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-bold text-2xl text-foreground">Precificação Estratégica</h1>
          <p className="text-sm text-muted-foreground mt-1">Simulações de proposta econômica e recomendações táticas</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-6 mb-8 bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">Nova Simulação</h2>
              <p className="text-sm text-muted-foreground mt-1">Insira o valor estimado, custos e margem desejada para receber recomendações de preço.</p>
            </div>
            <Button className="gap-2 flex-shrink-0"><Calculator className="w-4 h-4" /> Criar Simulação</Button>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Simulações Realizadas", value: "23",    icon: Calculator, color: "text-primary"        },
            { label: "Margem Média",           value: "15.8%", icon: Percent,    color: "text-emerald-500"    },
            { label: "Economia Gerada",        value: "R$ 1.2M", icon: DollarSign, color: "text-accent"       },
            { label: "Taxa de Acerto",         value: "67%",   icon: Target,     color: "text-primary"        },
          ].map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
          <h3 className="font-display font-semibold text-base text-foreground">Simulações Recentes</h3>
          {simulations.map((sim) => (
            <motion.div key={sim.id} variants={itemVariants}
              className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedSim(selectedSim === sim.id ? null : sim.id)}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-card-foreground">{sim.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{sim.organ}</p>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="text-center"><p className="font-bold text-card-foreground">{fmt(sim.estimatedValue)}</p><p className="text-xs text-muted-foreground">Valor estimado</p></div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-center"><p className="font-bold text-emerald-500">{fmt(sim.suggestedPrice)}</p><p className="text-xs text-muted-foreground">Preço sugerido</p></div>
                  <div className="text-center"><p className="font-bold text-card-foreground">{sim.margin}%</p><p className="text-xs text-muted-foreground">Margem</p></div>
                  <div className="text-center"><p className="font-bold text-card-foreground">{sim.winProbability}%</p><p className="text-xs text-muted-foreground">Prob. vitória</p></div>
                  <Badge variant="outline" className={recColors[sim.recommendation]}>{recLabels[sim.recommendation]}</Badge>
                </div>
              </div>

              {selectedSim === sim.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-card-foreground">Pontos fortes</p>
                        <p className="text-muted-foreground text-xs mt-1">Experiência comprovada no segmento, boa capacidade técnica e atestados válidos.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-card-foreground">Riscos identificados</p>
                        <p className="text-muted-foreground text-xs mt-1">{sim.competitors} concorrentes estimados. Mercado com tendência de descontos agressivos.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-card-foreground">Recomendação</p>
                        <p className="text-muted-foreground text-xs mt-1">{recDetails[sim.recommendation]}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </LicitanteLayout>
  );
}
