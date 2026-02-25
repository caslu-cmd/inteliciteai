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
import FloatingChat from "@/components/FloatingChat";

const steps = [
  { id: 1, title: "Dados Básicos" },
  { id: 2, title: "Necessidade" },
  { id: 3, title: "Requisitos" },
  { id: 4, title: "Riscos" },
  { id: 5, title: "Revisão" },
];

export default function ETPGeneratorPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    orgao: "",
    setor: "",
    responsavel: "",
    objeto: "",
    descricaoNecessidade: "",
    areaRequisitante: "",
    previsaoContratacao: "",
    requisitosNegocio: "",
    requisitosTecnicos: "",
    estimativaCusto: "",
    fontePesquisa: "",
    riscosPrincipais: "",
    mitigacao: "",
    alinhamentoEstrategico: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Órgão / Entidade</Label>
                <Input placeholder="Ex: Prefeitura Municipal de..." value={formData.orgao} onChange={(e) => updateField("orgao", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Setor Requisitante</Label>
                <Input placeholder="Ex: Secretaria de Administração" value={formData.setor} onChange={(e) => updateField("setor", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsável pela elaboração</Label>
              <Input placeholder="Nome completo" value={formData.responsavel} onChange={(e) => updateField("responsavel", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Objeto da contratação</Label>
              <Textarea placeholder="Descreva o objeto da contratação de forma clara e objetiva..." rows={3} value={formData.objeto} onChange={(e) => updateField("objeto", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Previsão de contratação</Label>
              <Select value={formData.previsaoContratacao} onValueChange={(v) => updateField("previsaoContratacao", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Até 30 dias</SelectItem>
                  <SelectItem value="60">30 a 60 dias</SelectItem>
                  <SelectItem value="90">60 a 90 dias</SelectItem>
                  <SelectItem value="120">Mais de 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição da Necessidade</Label>
              <Textarea placeholder="Descreva a necessidade que motiva a contratação, com referência ao planejamento estratégico do órgão..." rows={5} value={formData.descricaoNecessidade} onChange={(e) => updateField("descricaoNecessidade", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Área Requisitante</Label>
              <Input placeholder="Setor que demanda a contratação" value={formData.areaRequisitante} onChange={(e) => updateField("areaRequisitante", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alinhamento estratégico</Label>
              <Textarea placeholder="Como esta contratação se alinha ao planejamento do órgão?" rows={3} value={formData.alinhamentoEstrategico} onChange={(e) => updateField("alinhamentoEstrategico", e.target.value)} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Requisitos de Negócio</Label>
              <Textarea placeholder="Liste os requisitos funcionais e de negócio da contratação..." rows={4} value={formData.requisitosNegocio} onChange={(e) => updateField("requisitosNegocio", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Requisitos Técnicos</Label>
              <Textarea placeholder="Especificações técnicas mínimas, padrões, normas aplicáveis..." rows={4} value={formData.requisitosTecnicos} onChange={(e) => updateField("requisitosTecnicos", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimativa de custo (R$)</Label>
                <Input placeholder="Ex: 150.000,00" value={formData.estimativaCusto} onChange={(e) => updateField("estimativaCusto", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fonte da pesquisa de preços</Label>
                <Select value={formData.fontePesquisa} onValueChange={(v) => updateField("fontePesquisa", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="painel">Painel de Preços</SelectItem>
                    <SelectItem value="atas">Atas de Registro de Preços</SelectItem>
                    <SelectItem value="contratos">Contratos anteriores</SelectItem>
                    <SelectItem value="mercado">Pesquisa de mercado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Riscos Principais</Label>
              <Textarea placeholder="Identifique os principais riscos envolvidos na contratação (Art. 18, X da Lei 14.133)..." rows={5} value={formData.riscosPrincipais} onChange={(e) => updateField("riscosPrincipais", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Medidas de Mitigação</Label>
              <Textarea placeholder="Descreva as ações para mitigar cada risco identificado..." rows={5} value={formData.mitigacao} onChange={(e) => updateField("mitigacao", e.target.value)} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/5 border border-success/20 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">ETP pronto para geração</p>
                <p className="text-xs text-muted-foreground mt-1">Revise os dados no preview ao lado antes de exportar.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Órgão", formData.orgao],
                ["Objeto", formData.objeto],
                ["Necessidade", formData.descricaoNecessidade],
                ["Estimativa", formData.estimativaCusto ? `R$ ${formData.estimativaCusto}` : ""],
                ["Riscos", formData.riscosPrincipais],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="border-b border-border pb-2">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-0.5 line-clamp-2">{value}</p>
                  </div>
                ))}
            </div>
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
          <h1 className="text-xl font-bold">Gerador de ETP</h1>
          <p className="text-sm text-muted-foreground">Estudo Técnico Preliminar — Art. 18 da Lei 14.133/2021</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                currentStep === step.id
                  ? "bg-accent/10 text-accent"
                  : currentStep > step.id
                  ? "bg-success/10 text-success"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep === step.id
                  ? "bg-accent text-accent-foreground"
                  : currentStep > step.id
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
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
        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-lg font-semibold mb-4">{steps[currentStep - 1].title}</h2>
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Save className="mr-1 h-3.5 w-3.5" /> Salvar rascunho
              </Button>
              {currentStep < steps.length ? (
                <Button variant="gold" onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}>
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button variant="gold" onClick={() => {
                  import("@/lib/exportDocument").then(({ exportAsPdf }) => {
                    exportAsPdf({
                      documentTitle: "Estudo Técnico Preliminar",
                      orgao: formData.orgao,
                      legalBasis: "Lei nº 14.133/2021 — Art. 18",
                      sections: [
                        { title: "Objeto", content: formData.objeto },
                        { title: "Descrição da Necessidade", content: formData.descricaoNecessidade },
                        { title: "Alinhamento Estratégico", content: formData.alinhamentoEstrategico },
                        { title: "Requisitos de Negócio", content: formData.requisitosNegocio },
                        { title: "Requisitos Técnicos", content: formData.requisitosTecnicos },
                        { title: "Estimativa de Custo", content: formData.estimativaCusto ? `R$ ${formData.estimativaCusto}` : "" },
                        { title: "Análise de Riscos", content: formData.riscosPrincipais },
                        { title: "Medidas de Mitigação", content: formData.mitigacao },
                      ],
                    });
                  });
                }}>
                  <Download className="mr-1 h-4 w-4" /> Gerar documento
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-accent" />
            <h3 className="font-semibold text-sm">Preview do documento</h3>
          </div>
          <div className="rounded-lg border border-border bg-background p-6 min-h-[400px] text-sm space-y-4">
            <div className="text-center border-b border-border pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Estudo Técnico Preliminar</p>
              <p className="font-bold mt-1">{formData.orgao || "Órgão não informado"}</p>
              <p className="text-xs text-muted-foreground mt-1">Lei nº 14.133/2021 — Art. 18</p>
            </div>
            {formData.objeto && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">1. Objeto</p>
                <p className="mt-1">{formData.objeto}</p>
              </div>
            )}
            {formData.descricaoNecessidade && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">2. Descrição da Necessidade</p>
                <p className="mt-1">{formData.descricaoNecessidade}</p>
              </div>
            )}
            {formData.requisitosNegocio && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">3. Requisitos de Negócio</p>
                <p className="mt-1">{formData.requisitosNegocio}</p>
              </div>
            )}
            {formData.requisitosTecnicos && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">4. Requisitos Técnicos</p>
                <p className="mt-1">{formData.requisitosTecnicos}</p>
              </div>
            )}
            {formData.estimativaCusto && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">5. Estimativa de Custo</p>
                <p className="mt-1">R$ {formData.estimativaCusto}</p>
              </div>
            )}
            {formData.riscosPrincipais && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">6. Análise de Riscos</p>
                <p className="mt-1">{formData.riscosPrincipais}</p>
              </div>
            )}
            {!formData.objeto && !formData.descricaoNecessidade && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Preencha o formulário para ver o preview do documento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <FloatingChat />
    </div>
  );
}
