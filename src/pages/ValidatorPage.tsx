import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import FloatingChat, { FloatingChatRef } from "@/components/FloatingChat";

interface Finding {
  severity: "alta" | "media" | "baixa";
  title: string;
  description: string;
  article: string;
}

const mockFindings: Finding[] = [
  { severity: "alta", title: "Ausência de ETP", description: "O edital não faz referência ao Estudo Técnico Preliminar, requisito obrigatório.", article: "Art. 18, §1º" },
  { severity: "alta", title: "Critério de julgamento não especificado", description: "Não foi definido o critério de julgamento das propostas.", article: "Art. 33" },
  { severity: "media", title: "Prazo recursal insuficiente", description: "O prazo para interposição de recursos está abaixo do mínimo legal.", article: "Art. 165" },
  { severity: "media", title: "Cláusula de reequilíbrio ausente", description: "Não há previsão de reequilíbrio econômico-financeiro no contrato.", article: "Art. 124, II" },
  { severity: "baixa", title: "Formatação da garantia", description: "A exigência de garantia está redigida de forma ambígua.", article: "Art. 96" },
  { severity: "baixa", title: "Publicidade", description: "Verificar se o prazo mínimo de publicação foi respeitado.", article: "Art. 54" },
];

const severityConfig = {
  alta: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle, label: "Alta" },
  media: { color: "text-accent", bg: "bg-accent/10", icon: AlertTriangle, label: "Média" },
  baixa: { color: "text-success", bg: "bg-success/10", icon: CheckCircle2, label: "Baixa" },
};

export default function ValidatorPage() {
  const [state, setState] = useState<"upload" | "processing" | "results">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<FloatingChatRef>(null);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return;
    }
    setFileName(file.name);
    setState("processing");
    setTimeout(() => {
      setState("results");
      const summary = mockFindings
        .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description} (${f.article})`)
        .join("\n");
      setTimeout(() => {
        chatRef.current?.sendAutoMessage(
          `Acabei de validar um edital e encontrei os seguintes achados de conformidade com a Lei 14.133/2021:\n\n${summary}\n\nPor favor, analise esses achados e me dê orientações sobre como corrigir as não-conformidades mais críticas.`
        );
      }, 500);
    }, 3000);
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (state === "upload") {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
            <Search className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold">Validador de Editais</h1>
          <p className="mt-2 text-muted-foreground">
            Faça upload de um edital em PDF para análise automática de conformidade com a Lei 14.133/2021.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileInput}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer ${
            dragOver ? "border-accent bg-accent/5 shadow-gold" : "border-border hover:border-accent/40 hover:bg-secondary/30"
          }`}
          onClick={handleClickUpload}
        >
          <Upload className={`mx-auto h-10 w-10 mb-4 ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
          <p className="font-medium">Arraste o edital aqui ou clique para selecionar</p>
          <p className="mt-2 text-sm text-muted-foreground">Suporta arquivos PDF até 50MB</p>
        </motion.div>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-accent/20 shimmer" />
          <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-accent animate-spin" />
        </div>
        <h2 className="mt-6 text-lg font-semibold">Analisando edital...</h2>
        <p className="mt-2 text-sm text-muted-foreground">Verificando conformidade com a Lei 14.133/2021</p>
        <div className="mt-6 w-64 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-gradient-gold rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
        </div>
      </div>
    );
  }

  const high = mockFindings.filter((f) => f.severity === "alta").length;
  const med = mockFindings.filter((f) => f.severity === "media").length;
  const low = mockFindings.filter((f) => f.severity === "baixa").length;

  return (
    <div className="max-w-4xl relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Resultado da Análise</h1>
          <p className="text-sm text-muted-foreground mt-1">{fileName || "Edital"} — {mockFindings.length} achados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setState("upload")}>Nova análise</Button>
          <Button variant="gold" size="sm" onClick={() => {
            import("@/lib/exportDocument").then(({ exportValidatorReport }) => {
              exportValidatorReport(mockFindings);
            });
          }}><FileText className="mr-1 h-3.5 w-3.5" /> Exportar relatório</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Risco Alto", count: high, ...severityConfig.alta },
          { label: "Risco Médio", count: med, ...severityConfig.media },
          { label: "Risco Baixo", count: low, ...severityConfig.baixa },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-xl ${s.bg} p-4 text-center`}
          >
            <s.icon className={`mx-auto h-6 w-6 ${s.color}`} />
            <p className={`mt-2 text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Findings */}
      <div className="space-y-3">
        {mockFindings.map((finding, i) => {
          const config = severityConfig[finding.severity];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-navy transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${config.bg} shrink-0`}>
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{finding.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p>
                  <p className="mt-2 text-xs text-accent font-medium">{finding.article}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <FloatingChat ref={chatRef} />
    </div>
  );
}
