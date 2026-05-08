import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderCheck, Search, Upload, CheckCircle2, Clock, AlertTriangle, FileText, Eye, Download, Trash2 } from "lucide-react";

const documents = [
  { id: 1,  name: "Contrato Social Consolidado",      type: "Jurídica",               status: "disponivel", expiry: null,          uploadedAt: "10 Jan 2026" },
  { id: 2,  name: "CND Federal (Receita + PGFN)",     type: "Fiscal",                 status: "disponivel", expiry: "15 Jun 2026",  uploadedAt: "05 Mar 2026" },
  { id: 3,  name: "CND Estadual - ICMS",              type: "Fiscal",                 status: "pendente",   expiry: null,          uploadedAt: null },
  { id: 4,  name: "Certidão FGTS (CRF)",              type: "Fiscal",                 status: "vencido",    expiry: "01 Mar 2026",  uploadedAt: "01 Dez 2025" },
  { id: 5,  name: "CNDT - Certidão Trabalhista",      type: "Fiscal",                 status: "disponivel", expiry: "20 Set 2026",  uploadedAt: "20 Mar 2026" },
  { id: 6,  name: "Atestado de Capacidade Técnica",   type: "Técnica",                status: "pendente",   expiry: null,          uploadedAt: null },
  { id: 7,  name: "Certificação ISO 27001",           type: "Técnica",                status: "pendente",   expiry: null,          uploadedAt: null },
  { id: 8,  name: "Balanço Patrimonial 2025",         type: "Econômico-Financeira",   status: "disponivel", expiry: null,          uploadedAt: "15 Fev 2026" },
  { id: 9,  name: "Certidão Negativa de Falência",    type: "Econômico-Financeira",   status: "disponivel", expiry: "30 Ago 2026",  uploadedAt: "01 Mar 2026" },
  { id: 10, name: "Procuração do Representante Legal",type: "Jurídica",               status: "disponivel", expiry: null,          uploadedAt: "10 Jan 2026" },
];

const statusConfig = {
  disponivel: { label: "Disponível", icon: CheckCircle2, className: "text-success bg-success/10"        },
  pendente:   { label: "Pendente",   icon: Clock,        className: "text-amber-400 bg-amber-400/10"    },
  vencido:    { label: "Vencido",    icon: AlertTriangle, className: "text-destructive bg-destructive/10" },
};

export default function DocumentosPage() {
  const [activeTab, setActiveTab] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = documents.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTab =
      activeTab === "Todos" ||
      (activeTab === "Disponível" && d.status === "disponivel") ||
      (activeTab === "Pendente"   && d.status === "pendente")   ||
      (activeTab === "Vencido"    && d.status === "vencido");
    return matchSearch && matchTab;
  });

  const counts = {
    disponivel: documents.filter((d) => d.status === "disponivel").length,
    pendente:   documents.filter((d) => d.status === "pendente").length,
    vencido:    documents.filter((d) => d.status === "vencido").length,
  };

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <FolderCheck className="w-6 h-6 text-primary" /> Documentos &amp; Checklist
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {counts.disponivel} disponíveis · {counts.pendente} pendentes · {counts.vencido} vencidos
            </p>
          </div>
          <Button className="gap-2"><Upload className="w-4 h-4" /> Enviar Documento</Button>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {["Todos", "Disponível", "Pendente", "Vencido"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
              }`}>
              {tab}
            </button>
          ))}
          <div className="ml-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar documento..." className="pl-10 w-60" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((doc, i) => {
            const config = statusConfig[doc.status as keyof typeof statusConfig];
            const StatusIcon = config.icon;
            return (
              <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-card rounded-lg border border-border p-4 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{doc.type}</span>
                    {doc.expiry && <span className="text-xs text-muted-foreground">Validade: {doc.expiry}</span>}
                    {doc.uploadedAt && <span className="text-xs text-muted-foreground">Enviado: {doc.uploadedAt}</span>}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${config.className}`}>
                  <StatusIcon className="w-3 h-3" />{config.label}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </LicitanteLayout>
  );
}
