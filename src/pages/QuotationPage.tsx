import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Plus, Trash2, Download, Sparkles, Loader2, X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CostItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

interface SimulacaoItem {
  descricao: string;
  faixaMin: number;
  faixaMax: number;
  referencia: string;
}

interface Simulacao {
  itens: SimulacaoItem[];
  alertas: string[];
  recomendacoes: string[];
  totalEstimado: number;
}

export default function QuotationPage() {
  const [items, setItems] = useState<CostItem[]>([
    { id: "1", descricao: "", quantidade: 1, valorUnitario: 0 },
  ]);
  const [margem, setMargem] = useState("15");
  const [impostos, setImpostos] = useState("8.65");
  const [simulating, setSimulating] = useState(false);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  const addItem = () =>
    setItems([...items, { id: Date.now().toString(), descricao: "", quantidade: 1, valorUnitario: 0 }]);

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof CostItem, value: string | number) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const subtotal = items.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0);
  const margemVal = subtotal * (parseFloat(margem) / 100);
  const impostosVal = (subtotal + margemVal) * (parseFloat(impostos) / 100);
  const total = subtotal + margemVal + impostosVal;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSimulate = async () => {
    const filledItems = items.filter((i) => i.descricao.trim());
    if (filledItems.length === 0) {
      toast.error("Preencha a descrição de pelo menos um item.");
      return;
    }
    setSimulating(true);
    setSimulacao(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            tipo: "cotacao",
            formData: { itens: filledItems, margem, impostos },
          }),
        }
      );
      if (!res.ok) throw new Error("Falha");
      const data: Simulacao = await res.json();
      setSimulacao(data);
    } catch {
      toast.error("Erro ao simular. Tente novamente.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8 mt-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
          <Calculator className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold">Cotação Inteligente</h1>
        <p className="mt-2 text-muted-foreground">
          Monte sua proposta e simule preços de mercado com IA — baseado em padrões de compras governamentais.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Items */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Composição de Custos</h2>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-12 gap-2 items-end rounded-lg sm:rounded-none border sm:border-0 border-border p-3 sm:p-0">
                <div className="col-span-12 sm:col-span-5">
                  {idx === 0 && <Label className="text-xs hidden sm:block">Descrição</Label>}
                  <Label className="text-xs sm:hidden">Descrição</Label>
                  <Input placeholder="Item / Serviço" value={item.descricao} onChange={(e) => updateItem(item.id, "descricao", e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {idx === 0 && <Label className="text-xs hidden sm:block">Qtd</Label>}
                  <Label className="text-xs sm:hidden">Qtd</Label>
                  <Input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(item.id, "quantidade", parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-span-8 sm:col-span-3">
                  {idx === 0 && <Label className="text-xs hidden sm:block">Valor Unit. (R$)</Label>}
                  <Label className="text-xs sm:hidden">Valor Unit. (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={item.valorUnitario || ""} onChange={(e) => updateItem(item.id, "valorUnitario", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-12 sm:col-span-2 flex justify-between sm:justify-end gap-2 items-center">
                  {idx === 0 && <Label className="text-xs invisible hidden sm:block">.</Label>}
                  <span className="text-sm font-medium sm:w-full sm:text-right">{fmt(item.quantidade * item.valorUnitario)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={addItem}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Margem de lucro (%)</Label>
              <Input type="number" value={margem} onChange={(e) => setMargem(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Impostos (%)</Label>
              <Input type="number" value={impostos} onChange={(e) => setImpostos(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-4">Resumo da Proposta</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margem ({margem}%)</span>
                <span className="font-medium">{fmt(margemVal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impostos ({impostos}%)</span>
                <span className="font-medium">{fmt(impostosVal)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-lg text-accent">{fmt(total)}</span>
              </div>
            </div>
          </div>

          <Button variant="gold" className="w-full" onClick={handleSimulate} disabled={simulating}>
            {simulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Simular com IA
          </Button>
          <Button variant="outline" className="w-full" onClick={() => {
            import("@/lib/exportDocument").then(({ exportQuotation }) => {
              exportQuotation(items, margem, impostos, subtotal, total);
            });
          }}>
            <Download className="mr-2 h-4 w-4" /> Exportar proposta
          </Button>
        </div>
      </div>

      {/* Simulação result */}
      <AnimatePresence>
        {(simulating || simulacao) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Simulação de Preços de Mercado — IA
              </h3>
              {simulacao && (
                <button onClick={() => setSimulacao(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {simulating ? (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                <span className="text-sm">Consultando preços de referência...</span>
              </div>
            ) : simulacao && (
              <div className="space-y-6">
                {/* Faixas por item */}
                {simulacao.itens && simulacao.itens.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Faixas de preço por item</h4>
                    <div className="space-y-2">
                      {simulacao.itens.map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.referencia}</p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="font-semibold text-accent">{fmt(item.faixaMin)} – {fmt(item.faixaMax)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total estimado */}
                {simulacao.totalEstimado > 0 && (
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 flex items-center justify-between">
                    <span className="text-sm font-medium">Estimativa total de mercado</span>
                    <span className="font-bold text-lg text-accent">{fmt(simulacao.totalEstimado)}</span>
                  </div>
                )}

                {/* Alertas */}
                {simulacao.alertas && simulacao.alertas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Alertas</h4>
                    <div className="space-y-2">
                      {simulacao.alertas.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                          {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recomendações */}
                {simulacao.recomendacoes && simulacao.recomendacoes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Recomendações</h4>
                    <div className="space-y-2">
                      {simulacao.recomendacoes.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Valores estimados pela IA com base em padrões de compras governamentais. Confirme com pesquisa de preços formal conforme IN SEGES/ME nº 65/2021.
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
