import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, ArrowRight, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FloatingChat from "@/components/FloatingChat";

interface DiagnosticResult {
  modalidade: string;
  fundamento: string;
  descricao: string;
  alertas: string[];
  recomendacoes: string[];
}

const diagnosticResults: Record<string, DiagnosticResult> = {
  baixo: {
    modalidade: "Dispensa de Licitação",
    fundamento: "Art. 75, I e II da Lei 14.133/2021",
    descricao: "Para contratações de menor valor, a dispensa de licitação é a modalidade mais adequada, dispensando procedimento licitatório formal.",
    alertas: ["Verificar se o valor está dentro dos limites legais", "Necessária pesquisa de preços com no mínimo 3 fontes"],
    recomendacoes: ["Documentar a justificativa da escolha", "Manter registro dos orçamentos obtidos", "Verificar se não há fracionamento de despesa"],
  },
  medio: {
    modalidade: "Pregão Eletrônico",
    fundamento: "Art. 28, I da Lei 14.133/2021",
    descricao: "O Pregão Eletrônico é a modalidade obrigatória para aquisição de bens e serviços comuns, com fase competitiva invertida.",
    alertas: ["Elaborar ETP obrigatório", "Definir critério de julgamento adequado", "Prazo mínimo de publicação: 8 dias úteis"],
    recomendacoes: ["Utilizar o sistema Comprasnet ou equivalente", "Incluir cláusulas de sustentabilidade", "Prever critérios de desempate (Art. 60)"],
  },
  alto: {
    modalidade: "Concorrência Eletrônica",
    fundamento: "Art. 28, II da Lei 14.133/2021",
    descricao: "Para contratações de maior complexidade e valor, a Concorrência é a modalidade indicada, com análise técnica e financeira.",
    alertas: ["Prazo mínimo de publicação: 25 dias úteis", "Obrigatório audiência pública para valores acima de R$ 150 milhões", "Necessário projeto básico ou executivo completo"],
    recomendacoes: ["Constituir comissão de contratação", "Realizar análise de riscos detalhada", "Considerar seguro-garantia conforme Art. 96"],
  },
};

export default function DiagnosticPage() {
  const [valorEstimado, setValorEstimado] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [tipoObjeto, setTipoObjeto] = useState("");
  const [showResult, setShowResult] = useState(false);

  const getResult = (): DiagnosticResult => {
    const valor = parseFloat(valorEstimado.replace(/\D/g, "")) || 0;
    if (valor < 50000 || urgencia === "alto") return diagnosticResults.baixo;
    if (valor < 500000) return diagnosticResults.medio;
    return diagnosticResults.alto;
  };

  const result = getResult();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8 mt-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
          <Scale className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold">Diagnóstico de Licitação</h1>
        <p className="mt-2 text-muted-foreground">
          Informe os dados básicos e receba a modalidade recomendada com fundamentação legal.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Valor Estimado (R$)</Label>
            <Input
              placeholder="Ex: 250.000,00"
              value={valorEstimado}
              onChange={(e) => setValorEstimado(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Urgência</Label>
            <Select value={urgencia} onValueChange={setUrgencia}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixo">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alto">Alta (Emergencial)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de objeto</Label>
            <Select value={tipoObjeto} onValueChange={setTipoObjeto}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bens">Bens comuns</SelectItem>
                <SelectItem value="servicos">Serviços comuns</SelectItem>
                <SelectItem value="engenharia">Serviços de engenharia</SelectItem>
                <SelectItem value="obras">Obras</SelectItem>
                <SelectItem value="ti">Soluções de TI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Button
            variant="gold"
            onClick={() => setShowResult(true)}
            disabled={!valorEstimado || !urgencia || !tipoObjeto}
          >
            Diagnosticar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8 space-y-4"
          >
            <div className="rounded-xl border-2 border-accent bg-accent/5 p-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Modalidade Recomendada</p>
              <h2 className="text-2xl font-bold text-accent">{result.modalidade}</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{result.fundamento}</p>
              <p className="mt-3 text-sm text-foreground max-w-lg mx-auto">{result.descricao}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-accent" /> Alertas
                </h3>
                <ul className="space-y-2">
                  {result.alertas.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Recomendações
                </h3>
                <ul className="space-y-2">
                  {result.recomendacoes.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-success shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <FloatingChat />
    </div>
  );
}
