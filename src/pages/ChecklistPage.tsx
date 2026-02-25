import { useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, CheckCircle2, Circle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FloatingChat from "@/components/FloatingChat";

interface CheckItem {
  id: string;
  text: string;
  category: string;
  required: boolean;
}

const checklistItems: Record<string, CheckItem[]> = {
  bens: [
    { id: "1", text: "Estudo Técnico Preliminar (ETP) elaborado", category: "Planejamento", required: true },
    { id: "2", text: "Termo de Referência com especificações do bem", category: "Planejamento", required: true },
    { id: "3", text: "Pesquisa de preços com no mínimo 3 fontes", category: "Planejamento", required: true },
    { id: "4", text: "Mapa de Riscos elaborado (Art. 18, X)", category: "Planejamento", required: true },
    { id: "5", text: "Justificativa da necessidade da contratação", category: "Documentos", required: true },
    { id: "6", text: "Dotação orçamentária indicada", category: "Documentos", required: true },
    { id: "7", text: "Minuta do edital revisada pela assessoria jurídica", category: "Jurídico", required: true },
    { id: "8", text: "Parecer jurídico favorável (Art. 53, §4º)", category: "Jurídico", required: true },
    { id: "9", text: "Cadastro no sistema eletrônico de compras", category: "Operacional", required: false },
    { id: "10", text: "Publicação no PNCP (Art. 174)", category: "Publicidade", required: true },
    { id: "11", text: "Prazo mínimo de publicação respeitado", category: "Publicidade", required: true },
    { id: "12", text: "Critérios de sustentabilidade avaliados", category: "Compliance", required: false },
  ],
  servicos: [
    { id: "1", text: "ETP com análise de make or buy", category: "Planejamento", required: true },
    { id: "2", text: "TR com descrição detalhada dos serviços", category: "Planejamento", required: true },
    { id: "3", text: "Planilha de custos e formação de preços", category: "Planejamento", required: true },
    { id: "4", text: "Convenção coletiva de trabalho verificada", category: "Planejamento", required: true },
    { id: "5", text: "Instrumento de medição de resultado (IMR) definido", category: "Gestão", required: true },
    { id: "6", text: "Conta vinculada para encargos trabalhistas", category: "Gestão", required: false },
    { id: "7", text: "Parecer jurídico do edital", category: "Jurídico", required: true },
    { id: "8", text: "Publicação no PNCP", category: "Publicidade", required: true },
  ],
  obras: [
    { id: "1", text: "Projeto básico ou executivo completo", category: "Planejamento", required: true },
    { id: "2", text: "Licenças ambientais obtidas", category: "Planejamento", required: true },
    { id: "3", text: "Orçamento detalhado (SINAPI/SICRO)", category: "Planejamento", required: true },
    { id: "4", text: "BDI adequado e justificado", category: "Planejamento", required: true },
    { id: "5", text: "ART/RRT do projeto", category: "Documentos", required: true },
    { id: "6", text: "Regime de execução definido", category: "Documentos", required: true },
    { id: "7", text: "Seguro-garantia exigido (Art. 96)", category: "Garantias", required: false },
    { id: "8", text: "Parecer jurídico favorável", category: "Jurídico", required: true },
    { id: "9", text: "Publicação com prazo mínimo de 25 dias úteis", category: "Publicidade", required: true },
  ],
};

export default function ChecklistPage() {
  const [tipo, setTipo] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const items = tipo ? checklistItems[tipo] || [] : [];
  const categories = [...new Set(items.map((i) => i.category))];
  const progress = items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0;

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8 mt-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
          <CheckSquare className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold">Checklist de Qualificação</h1>
        <p className="mt-2 text-muted-foreground">
          Geração dinâmica conforme tipo de contratação e Lei 14.133/2021.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <Label>Tipo de Contratação</Label>
        <Select value={tipo} onValueChange={(v) => { setTipo(v); setChecked(new Set()); }}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bens">Aquisição de Bens</SelectItem>
            <SelectItem value="servicos">Prestação de Serviços</SelectItem>
            <SelectItem value="obras">Obras e Engenharia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Progress */}
          <div className="rounded-xl border border-border bg-card p-4 mb-6 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{checked.size} de {items.length} itens</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-gold rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
            <Button variant="gold" size="sm" disabled={progress < 100} onClick={() => {
              import("@/lib/exportDocument").then(({ exportChecklist }) => {
                exportChecklist(tipo, items, checked);
              });
            }}>
              <Download className="mr-1 h-3.5 w-3.5" /> Exportar
            </Button>
          </div>

          {/* Items by category */}
          {categories.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{cat}</h3>
              <div className="space-y-1">
                {items.filter((i) => i.category === cat).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                      checked.has(item.id)
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                  >
                    {checked.has(item.id) ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={checked.has(item.id) ? "line-through text-muted-foreground" : ""}>
                      {item.text}
                    </span>
                    {item.required && (
                      <span className="ml-auto text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded shrink-0">
                        Obrigatório
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
      <FloatingChat />
    </div>
  );
}
