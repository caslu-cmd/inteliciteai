import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { RiskBadge } from "@/components/licitante/RiskBadge";
import { VictoryScore } from "@/components/licitante/VictoryScore";
import { Button } from "@/components/ui/button";
import {
  FileUp, Clock, FileCheck, AlertTriangle, Scale,
  FileText, HelpCircle, Radar, ChevronDown, Search,
} from "lucide-react";

const diagnosticSections = [
  {
    id: "resumo", title: "Resumo da Licitação", icon: FileCheck,
    content: {
      objeto: "Aquisição de equipamentos de tecnologia da informação, incluindo servidores, switches e infraestrutura de rede para modernização do data center central.",
      modalidade: "Pregão Eletrônico",
      valorEstimado: "R$ 2.450.000,00",
      orgao: "Ministério da Saúde",
      processo: "25380.004567/2026-12",
    },
  },
  {
    id: "prazos", title: "Prazos Importantes", icon: Clock,
    items: [
      { label: "Publicação",    date: "10 Mar 2026", status: "past" },
      { label: "Impugnação",   date: "18 Mar 2026", status: "urgent" },
      { label: "Esclarecimento", date: "18 Mar 2026", status: "urgent" },
      { label: "Abertura",     date: "22 Mar 2026", status: "upcoming" },
      { label: "Entrega",      date: "22 Mai 2026", status: "future" },
    ],
  },
  {
    id: "habilitacao", title: "Requisitos de Habilitação", icon: Scale,
    categories: [
      { name: "Jurídica",                  status: "apto"       as const, items: ["Ato constitutivo", "Procuração"] },
      { name: "Fiscal",                    status: "risco"      as const, items: ["CND Federal", "CND Estadual", "FGTS"] },
      { name: "Técnica",                   status: "nao_atende" as const, items: ["Atestado de capacidade", "Certificação ISO"] },
      { name: "Econômico-Financeira",      status: "apto"       as const, items: ["Balanço patrimonial", "Capital social"] },
    ],
  },
  {
    id: "riscos", title: "Riscos Identificados", icon: AlertTriangle,
    risks: [
      { level: "high"   as const, title: "Exigência de certificação ISO 27001 obrigatória",  ref: "Art. 67, §1º - Lei 14.133/2021", excerpt: "Item 8.4.2 - A licitante deverá apresentar certificação ISO/IEC 27001 vigente..." },
      { level: "medium" as const, title: "Capital social mínimo de R$ 245.000,00",            ref: "Art. 69, I - Lei 14.133/2021",   excerpt: "Item 9.2.1 - Comprovar capital social mínimo de 10% do valor estimado..." },
      { level: "low"    as const, title: "Prazo de entrega exíguo (60 dias)",                 ref: "Art. 55, §1º - Lei 14.133/2021", excerpt: "Item 12.1 - A entrega deverá ocorrer em até 60 dias corridos..." },
    ],
  },
];

const statusMap = {
  apto:       { label: "Apto",       className: "bg-success/10 text-success border-success/20" },
  risco:      { label: "Risco Médio", className: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  nao_atende: { label: "Não Atende", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function ScannerPage() {
  const [expandedSections, setExpandedSections] = useState<string[]>(["resumo", "riscos"]);
  const [hasDocument, setHasDocument] = useState(true);
  const navigate = useNavigate();

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  if (!hasDocument) {
    return (
      <LicitanteLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl gradient-primary mx-auto mb-6 flex items-center justify-center">
              <FileUp className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-display font-bold text-xl text-foreground mb-2">Envie um Edital para Análise</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Arraste um PDF ou clique para selecionar. Nossa IA analisará o documento completo em segundos.
            </p>
            <Button onClick={() => setHasDocument(true)}>Selecionar PDF</Button>
          </motion.div>
        </div>
      </LicitanteLayout>
    );
  }

  return (
    <LicitanteLayout>
      <div className="h-[calc(100vh)] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h2 className="font-display font-semibold text-sm text-foreground">PE 045/2026 — Equipamentos de TI</h2>
            <RiskBadge level="medium" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/minutas")}>
              <FileText className="w-3.5 h-3.5" /> Gerar Impugnação
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/minutas")}>
              <HelpCircle className="w-3.5 h-3.5" /> Pedido de Esclarecimento
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/habilitacao")}>
              <Scale className="w-3.5 h-3.5" /> Simular Habilitação
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/radar")}>
              <Radar className="w-3.5 h-3.5" /> Adicionar ao Radar
            </Button>
          </div>
        </div>

        {/* Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Viewer */}
          <div className="w-[60%] border-r border-border bg-muted/30 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar no documento..." className="text-sm bg-transparent focus:outline-none flex-1" />
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center w-full max-w-sm mx-auto space-y-3">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`h-3 rounded-full ${
                      i === 0 ? "w-2/3 bg-primary/20" :
                      i === 5 || i === 9 ? "w-1/2 bg-amber-400/20 border border-amber-400/30" :
                      "w-full bg-muted"
                    }`}
                  />
                ))}
                <p className="text-xs text-muted-foreground mt-6">Visualizador de PDF — Documento carregado</p>
              </div>
            </div>
          </div>

          {/* Diagnostic Panel */}
          <div className="w-[40%] overflow-y-auto">
            <div className="p-5 border-b border-border bg-card">
              <div className="flex items-center gap-5">
                <VictoryScore score={52} size={80} />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Chance de Vitória</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Baseado em 12 critérios técnicos, perfil da empresa e histórico do órgão
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {diagnosticSections.map((section) => {
                const isExpanded = expandedSections.includes(section.id);
                const Icon = section.icon;
                return (
                  <div key={section.id}>
                    <button onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-sm text-card-foreground flex-1 text-left">{section.title}</span>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    </button>

                    <motion.div initial={false} animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="px-5 pb-5">
                        {section.id === "resumo" && section.content && (
                          <div className="space-y-2.5">
                            {Object.entries(section.content).map(([key, val]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground min-w-[100px] capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                                <span className="text-sm text-card-foreground">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.id === "prazos" && section.items && (
                          <div className="space-y-2">
                            {section.items.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                                <div className={`w-2 h-2 rounded-full ${
                                  item.status === "past"     ? "bg-muted-foreground" :
                                  item.status === "urgent"   ? "bg-destructive animate-pulse-glow" :
                                  item.status === "upcoming" ? "bg-amber-400" :
                                  "bg-muted-foreground/40"
                                }`} />
                                <span className="text-sm text-card-foreground flex-1">{item.label}</span>
                                <span className="text-xs font-mono-legal text-muted-foreground">{item.date}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.id === "habilitacao" && section.categories && (
                          <div className="space-y-3">
                            {section.categories.map((cat, i) => (
                              <div key={i} className="p-3 rounded-lg border border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-card-foreground">{cat.name}</span>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusMap[cat.status].className}`}>
                                    {statusMap[cat.status].label}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {cat.items.map((item, j) => (
                                    <span key={j} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{item}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.id === "riscos" && section.risks && (
                          <div className="space-y-3">
                            {section.risks.map((risk, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                className="p-3 rounded-lg border border-border">
                                <div className="flex items-start gap-2 mb-2">
                                  <RiskBadge level={risk.level} />
                                  <span className="text-sm font-medium text-card-foreground leading-snug">{risk.title}</span>
                                </div>
                                <p className="text-xs font-mono-legal text-muted-foreground mb-1">{risk.ref}</p>
                                <p className="text-xs text-muted-foreground italic">"{risk.excerpt}"</p>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
