import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Eye, Download, Copy, Clock, CheckCircle2, PenLine, Send, Scale, HelpCircle } from "lucide-react";

const minutas = [
  { id: 1, title: "Impugnação - PE 045/2026 - Exigência ISO 27001",           type: "impugnacao",    edital: "PE 045/2026 - Min. da Saúde", status: "gerado",     version: 2, createdAt: "15 Mar 2026", updatedAt: "16 Mar 2026", legalBasis: "Art. 67, §1º - Lei 14.133/2021" },
  { id: 2, title: "Pedido de Esclarecimento - Prazo de entrega exíguo",        type: "esclarecimento", edital: "PE 045/2026 - Min. da Saúde", status: "rascunho",   version: 1, createdAt: "16 Mar 2026", updatedAt: "16 Mar 2026", legalBasis: "Art. 55, §1º - Lei 14.133/2021" },
  { id: 3, title: "Impugnação - Concorrência 012/2026 - Capital social",       type: "impugnacao",    edital: "CC 012/2026 - TJSP",          status: "assinado",   version: 3, createdAt: "10 Mar 2026", updatedAt: "14 Mar 2026", legalBasis: "Art. 69, I - Lei 14.133/2021"   },
  { id: 4, title: "Pedido de Esclarecimento - Especificações técnicas",        type: "esclarecimento", edital: "PE-2026/045-PMC",             status: "protocolado", version: 1, createdAt: "08 Mar 2026", updatedAt: "12 Mar 2026", legalBasis: "Art. 164, §2º - Lei 14.133/2021" },
];

const statusConfig = {
  rascunho:    { label: "Rascunho",    icon: PenLine,    className: "text-muted-foreground bg-muted/50"    },
  gerado:      { label: "Gerado",      icon: CheckCircle2, className: "text-success bg-success/10"         },
  assinado:    { label: "Assinado",    icon: CheckCircle2, className: "text-primary bg-primary/10"         },
  protocolado: { label: "Protocolado", icon: Send,       className: "text-primary bg-primary/10"           },
};

const typeConfig = {
  impugnacao:    { label: "Impugnação",    icon: Scale,       className: "text-destructive bg-destructive/10" },
  esclarecimento: { label: "Esclarecimento", icon: HelpCircle, className: "text-amber-400 bg-amber-400/10"   },
};

export default function MinutasPage() {
  const [filter, setFilter] = useState("todos");
  const filtered = minutas.filter((m) => filter === "todos" || m.type === filter);

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Minutas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Impugnações e pedidos de esclarecimento gerados pela IA</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 text-sm"><Scale className="w-4 h-4" /> Nova Impugnação</Button>
            <Button className="gap-2 text-sm"><Plus className="w-4 h-4" /> Novo Esclarecimento</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[{ key: "todos", label: "Todos" }, { key: "impugnacao", label: "Impugnações" }, { key: "esclarecimento", label: "Esclarecimentos" }].map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((minuta, i) => {
            const status = statusConfig[minuta.status as keyof typeof statusConfig];
            const type   = typeConfig[minuta.type as keyof typeof typeConfig];
            const StatusIcon = status.icon;
            const TypeIcon   = type.icon;
            return (
              <motion.div key={minuta.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${type.className}`}>
                        <TypeIcon className="w-3 h-3" />{type.label}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${status.className}`}>
                        <StatusIcon className="w-3 h-3" />{status.label}
                      </span>
                      <span className="text-xs text-muted-foreground">v{minuta.version}</span>
                    </div>
                    <h3 className="font-semibold text-sm text-card-foreground mb-1">{minuta.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Edital: {minuta.edital}</span>
                      <span>Base legal: <span className="font-mono-legal">{minuta.legalBasis}</span></span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Criado: {minuta.createdAt}</span>
                      <span>Atualizado: {minuta.updatedAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </LicitanteLayout>
  );
}
