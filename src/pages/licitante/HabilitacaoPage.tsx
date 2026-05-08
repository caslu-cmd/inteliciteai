import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, Upload, CheckCircle2, AlertTriangle, XCircle,
  FileText, Shield, TrendingUp, Scale, ChevronRight,
} from "lucide-react";

const categories = [
  {
    name: "Habilitação Jurídica", icon: Scale, status: "apto" as const,
    items: [
      { name: "Ato constitutivo / Contrato Social",      status: "disponivel" },
      { name: "Procuração do representante legal",        status: "disponivel" },
      { name: "Cédula de identidade do representante",    status: "disponivel" },
    ],
  },
  {
    name: "Regularidade Fiscal e Trabalhista", icon: Shield, status: "risco" as const,
    items: [
      { name: "CND Federal (Receita + PGFN)",  status: "disponivel" },
      { name: "CND Estadual (ICMS)",            status: "pendente"   },
      { name: "CND Municipal (ISS)",            status: "disponivel" },
      { name: "Certidão FGTS",                  status: "vencido"    },
      { name: "Certidão Trabalhista (CNDT)",    status: "disponivel" },
    ],
  },
  {
    name: "Qualificação Técnica", icon: FileText, status: "nao_atende" as const,
    items: [
      { name: "Atestado de capacidade técnica", status: "pendente"   },
      { name: "Certificação ISO 27001",          status: "pendente"   },
      { name: "Registro no CREA/CRA",            status: "disponivel" },
    ],
  },
  {
    name: "Qualificação Econômico-Financeira", icon: TrendingUp, status: "apto" as const,
    items: [
      { name: "Balanço patrimonial (último exercício)", status: "disponivel" },
      { name: "Demonstrações contábeis",                status: "disponivel" },
      { name: "Certidão negativa de falência",          status: "disponivel" },
    ],
  },
];

const statusConfig = {
  apto:       { label: "Apto",       icon: CheckCircle2, className: "bg-success/10 text-success border-success/20"           },
  risco:      { label: "Risco Médio", icon: AlertTriangle, className: "bg-amber-400/10 text-amber-400 border-amber-400/20"   },
  nao_atende: { label: "Não Atende", icon: XCircle,      className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const itemStatusConfig = {
  disponivel: { label: "Disponível", className: "text-success"      },
  pendente:   { label: "Pendente",   className: "text-amber-400"    },
  vencido:    { label: "Vencido",    className: "text-destructive"  },
};

export default function HabilitacaoPage() {
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Simulador de Habilitação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Compare o perfil da empresa com os requisitos do edital</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card mb-6">
          <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Razão Social</label>
              <Input defaultValue="Tech Solutions Ltda." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Capital Social</label>
              <Input defaultValue="R$ 500.000,00" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button className="gap-2"><Shield className="w-4 h-4" /> Simular Habilitação</Button>
            <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Enviar Documentos</Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => {
            const StatusIcon = statusConfig[cat.status].icon;
            const CatIcon = cat.icon;
            return (
              <motion.div key={cat.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-card-foreground">{cat.name}</h3>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusConfig[cat.status].className}`}>
                    <StatusIcon className="w-3 h-3" />{statusConfig[cat.status].label}
                  </span>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <span className="text-sm text-card-foreground">{item.name}</span>
                      <span className={`text-xs font-medium ${itemStatusConfig[item.status as keyof typeof itemStatusConfig].className}`}>
                        {itemStatusConfig[item.status as keyof typeof itemStatusConfig].label}
                      </span>
                    </div>
                  ))}
                </div>
                {cat.status !== "apto" && (
                  <Button variant="ghost" size="sm" className="mt-3 text-xs text-primary gap-1">
                    Corrigir pendências <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </LicitanteLayout>
  );
}
