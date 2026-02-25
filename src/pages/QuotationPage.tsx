import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Plus, Trash2, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CostItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

export default function QuotationPage() {
  const [items, setItems] = useState<CostItem[]>([
    { id: "1", descricao: "", quantidade: 1, valorUnitario: 0 },
  ]);
  const [margem, setMargem] = useState("15");
  const [impostos, setImpostos] = useState("8.65");
  const [showResult, setShowResult] = useState(false);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), descricao: "", quantidade: 1, valorUnitario: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof CostItem, value: string | number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const subtotal = items.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0);
  const margemVal = subtotal * (parseFloat(margem) / 100);
  const impostosVal = (subtotal + margemVal) * (parseFloat(impostos) / 100);
  const total = subtotal + margemVal + impostosVal;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8 mt-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
          <Calculator className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold">Cotação Inteligente</h1>
        <p className="mt-2 text-muted-foreground">
          Monte sua proposta comercial com composição de custos e simulações de cenário.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Items */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Composição de Custos</h2>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-5">
                  {idx === 0 && <Label className="text-xs">Descrição</Label>}
                  <Input
                    placeholder="Item / Serviço"
                    value={item.descricao}
                    onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <Label className="text-xs">Qtd</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(item.id, "quantidade", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-3">
                  {idx === 0 && <Label className="text-xs">Valor Unit. (R$)</Label>}
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.valorUnitario || ""}
                    onChange={(e) => updateItem(item.id, "valorUnitario", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 flex gap-1">
                  {idx === 0 && <Label className="text-xs invisible">.</Label>}
                  <span className="text-sm font-medium w-full text-right self-center">
                    {fmt(item.quantidade * item.valorUnitario)}
                  </span>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive shrink-0 self-center">
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

          <Button variant="gold" className="w-full" onClick={() => {
            import("@/lib/exportDocument").then(({ exportQuotation }) => {
              exportQuotation(items, margem, impostos, subtotal, total);
            });
          }}>
            <Download className="mr-2 h-4 w-4" /> Exportar proposta
          </Button>
          <Button variant="outline" className="w-full">
            Simular cenário <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
