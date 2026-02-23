import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Save,
  Download,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const steps = [
  { id: 1, title: "Identificação" },
  { id: 2, title: "Especificações" },
  { id: 3, title: "Condições" },
  { id: 4, title: "Revisão" },
];

export default function TRGeneratorPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    orgao: "",
    objeto: "",
    justificativa: "",
    especificacoes: "",
    quantitativos: "",
    prazoExecucao: "",
    localEntrega: "",
    obrigacoesContratada: "",
    obrigacoesContratante: "",
    criterioAceitacao: "",
    sancoes: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Órgão / Entidade</Label>
              <Input placeholder="Nome do órgão" value={formData.orgao} onChange={(e) => updateField("orgao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objeto da contratação</Label>
              <Textarea placeholder="Defina o objeto de forma precisa..." rows={3} value={formData.objeto} onChange={(e) => updateField("objeto", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Textarea placeholder="Justifique a necessidade da contratação conforme Art. 6º, XXIII..." rows={4} value={formData.justificativa} onChange={(e) => updateField("justificativa", e.target.value)} />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Especificações Técnicas</Label>
              <Textarea placeholder="Descreva detalhadamente as especificações..." rows={5} value={formData.especificacoes} onChange={(e) => updateField("especificacoes", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantitativos</Label>
              <Textarea placeholder="Itens, quantidades e unidades de medida..." rows={3} value={formData.quantitativos} onChange={(e) => updateField("quantitativos", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo de execução</Label>
                <Select value={formData.prazoExecucao} onValueChange={(v) => updateField("prazoExecucao", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Local de entrega</Label>
                <Input placeholder="Endereço/local" value={formData.localEntrega} onChange={(e) => updateField("localEntrega", e.target.value)} />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Obrigações da Contratada</Label>
              <Textarea placeholder="Liste as obrigações da empresa contratada..." rows={4} value={formData.obrigacoesContratada} onChange={(e) => updateField("obrigacoesContratada", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Obrigações da Contratante</Label>
              <Textarea placeholder="Liste as obrigações do órgão contratante..." rows={4} value={formData.obrigacoesContratante} onChange={(e) => updateField("obrigacoesContratante", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Critérios de aceitação</Label>
              <Textarea placeholder="Defina os critérios para recebimento do objeto..." rows={3} value={formData.criterioAceitacao} onChange={(e) => updateField("criterioAceitacao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sanções administrativas</Label>
              <Textarea placeholder="Penalidades previstas conforme Art. 155 da Lei 14.133..." rows={3} value={formData.sancoes} onChange={(e) => updateField("sancoes", e.target.value)} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/5 border border-success/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">TR pronto para geração</p>
                <p className="text-xs text-muted-foreground mt-1">Revise os dados no preview.</p>
              </div>
            </div>
            {[
              ["Órgão", formData.orgao],
              ["Objeto", formData.objeto],
              ["Justificativa", formData.justificativa],
              ["Prazo", formData.prazoExecucao ? `${formData.prazoExecucao} dias` : ""],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="border-b border-border pb-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-0.5 line-clamp-2">{value}</p>
                </div>
              ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <FileText className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Gerador de TR</h1>
          <p className="text-sm text-muted-foreground">Termo de Referência — Art. 6º, XXIII da Lei 14.133/2021</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                currentStep === step.id ? "bg-accent/10 text-accent" : currentStep > step.id ? "bg-success/10 text-success" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep === step.id ? "bg-accent text-accent-foreground" : currentStep > step.id ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {currentStep > step.id ? "✓" : step.id}
              </span>
              <span className="hidden lg:inline">{step.title}</span>
            </button>
            {idx < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <h2 className="text-lg font-semibold mb-4">{steps[currentStep - 1].title}</h2>
              {renderStep()}
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Save className="mr-1 h-3.5 w-3.5" /> Salvar</Button>
              {currentStep < steps.length ? (
                <Button variant="gold" onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}>
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button variant="gold"><Download className="mr-1 h-4 w-4" /> Gerar documento</Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-accent" />
            <h3 className="font-semibold text-sm">Preview do documento</h3>
          </div>
          <div className="rounded-lg border border-border bg-background p-6 min-h-[400px] text-sm space-y-4">
            <div className="text-center border-b border-border pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Termo de Referência</p>
              <p className="font-bold mt-1">{formData.orgao || "Órgão não informado"}</p>
            </div>
            {formData.objeto && <div><p className="text-xs font-semibold text-muted-foreground uppercase">1. Objeto</p><p className="mt-1">{formData.objeto}</p></div>}
            {formData.justificativa && <div><p className="text-xs font-semibold text-muted-foreground uppercase">2. Justificativa</p><p className="mt-1">{formData.justificativa}</p></div>}
            {formData.especificacoes && <div><p className="text-xs font-semibold text-muted-foreground uppercase">3. Especificações</p><p className="mt-1">{formData.especificacoes}</p></div>}
            {!formData.objeto && !formData.justificativa && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Preencha o formulário para ver o preview.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
