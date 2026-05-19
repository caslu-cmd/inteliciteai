import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, ChevronRight, ChevronLeft, Save, Download, Sparkles,
  Loader2, Copy, Check, Building2, BookOpen, Table2, Wand2,
  Plus, X, Info, Maximize2, Minimize2, ArrowRight, ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FloatingChat from "@/components/FloatingChat";
import { exportAsPdf, exportAsDocx } from "@/lib/exportDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import HistoricalReportsSection, { ForecastData, UploadedReport } from "@/components/documents/HistoricalReportsSection";

// ── Form schema ──────────────────────────────────────────────────
const FORM0 = {
  numeroDFD: "",
  dataElaboracao: "",
  secretaria: "",
  setor: "",
  ordenador: "",
  responsavel: "",
  cargo: "",
  categoria: "",
  tipoContratacao: "",
  prioridade: "",
  dataPrevisao: "",
  objeto: "",
  justificativa: "",
  valorEstimado: "",
};
type DFDForm = typeof FORM0;

// ── Sections ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 1, title: "Identificação",   icon: Building2,     ref: "Dados do órgão, demandante e classificação",        required: ["secretaria", "setor", "responsavel", "categoria", "tipoContratacao", "prioridade"] },
  { id: 2, title: "Objeto",          icon: ClipboardList, ref: "Descrição objetiva do que será contratado",         required: ["objeto"] },
  { id: 3, title: "Justificativa",   icon: BookOpen,      ref: "Motivação e necessidade da demanda",                required: ["justificativa"] },
  { id: 4, title: "Itens",           icon: Table2,        ref: "Quantitativos e estimativa de valor",               required: ["valorEstimado"] },
];

// ── Helpers ───────────────────────────────────────────────────────
type SuggestProps = { campo: string; suggesting: string | null; onSuggest: (c: string) => void };

const SuggestBtn = ({ campo, suggesting, onSuggest }: SuggestProps) => (
  <button type="button" disabled={suggesting !== null} onClick={() => onSuggest(campo)}
    className="flex items-center gap-1 text-[10px] font-medium text-blue-500/80 hover:text-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
    {suggesting === campo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
    IA
  </button>
);

function FL({ label, req, tip, campo, suggesting, onSuggest, children }: {
  label: string; req?: boolean; tip?: string; campo?: string;
  suggesting?: string | null; onSuggest?: (c: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</Label>
          {tip && (
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">{tip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {campo && onSuggest && <SuggestBtn campo={campo} suggesting={suggesting!} onSuggest={onSuggest} />}
      </div>
      {children}
    </div>
  );
}

// ── Section renderers ─────────────────────────────────────────────
type SectionProps = {
  form: DFDForm;
  set: (f: keyof DFDForm, v: string) => void;
  suggesting: string | null;
  onSuggest: (campo: string) => void;
};

function Sec1({ form, set }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FL label="Nº do DFD" tip="Número de identificação do documento">
          <Input value={form.numeroDFD} onChange={e => set("numeroDFD", e.target.value)} placeholder="DFD.25.01.001" />
        </FL>
        <FL label="Data de Elaboração">
          <Input type="date" value={form.dataElaboracao} onChange={e => set("dataElaboracao", e.target.value)} />
        </FL>
        <FL label="Previsão de Contratação">
          <Input type="date" value={form.dataPrevisao} onChange={e => set("dataPrevisao", e.target.value)} />
        </FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Secretaria / Unidade" req tip="Unidade administrativa demandante">
          <Input value={form.secretaria} onChange={e => set("secretaria", e.target.value)} placeholder="Ex: Secretaria Municipal de Saúde" />
        </FL>
        <FL label="Setor Demandante" req>
          <Input value={form.setor} onChange={e => set("setor", e.target.value)} placeholder="Ex: Departamento de TI" />
        </FL>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Ordenador de Despesas" tip="Autoridade competente para autorizar a despesa">
          <Input value={form.ordenador} onChange={e => set("ordenador", e.target.value)} placeholder="Nome do ordenador de despesas" />
        </FL>
        <FL label="Responsável pela Demanda" req>
          <Input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} placeholder="Nome completo" />
        </FL>
      </div>
      <FL label="Cargo / Função">
        <Input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: Chefe de Setor" />
      </FL>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-4">
        <p className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Classificação da Demanda
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FL label="Categoria" req tip="Tipo do objeto da demanda">
            <Select value={form.categoria} onValueChange={v => set("categoria", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="bem">Bem / Material</SelectItem>
                <SelectItem value="obra">Obra / Engenharia</SelectItem>
              </SelectContent>
            </Select>
          </FL>
          <FL label="Tipo de Contratação" req>
            <Select value={form.tipoContratacao} onValueChange={v => set("tipoContratacao", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nova">Nova Contratação</SelectItem>
                <SelectItem value="prorrogacao">Prorrogação</SelectItem>
                <SelectItem value="aditivo">Aditivo</SelectItem>
                <SelectItem value="renovacao">Renovação</SelectItem>
              </SelectContent>
            </Select>
          </FL>
          <FL label="Grau de Prioridade" req>
            <Select value={form.prioridade} onValueChange={v => set("prioridade", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
              </SelectContent>
            </Select>
          </FL>
        </div>
      </div>
    </div>
  );
}

function Sec2({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
          Descreva de forma objetiva e clara o que será contratado — produto, serviço ou obra. A descrição deve ser sucinta mas suficiente para caracterizar o objeto.
        </p>
      </div>
      <FL label="Descrição do Objeto" req campo="objeto" suggesting={suggesting} onSuggest={onSuggest}
        tip="Descrição clara e objetiva do que será contratado. Ex: Contratação de empresa especializada em serviços de telefonia móvel para atender as demandas da Prefeitura Municipal.">
        <Textarea
          rows={8}
          className="text-sm resize-none"
          value={form.objeto}
          onChange={e => set("objeto", e.target.value)}
          placeholder="Descreva o objeto da contratação de forma objetiva, incluindo a natureza do serviço/bem/obra, as principais características e o propósito geral da demanda..."
        />
      </FL>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
        <span>{form.objeto.length} caracteres</span>
        <span>{form.objeto.split(/\s+/).filter(Boolean).length} palavras</span>
      </div>
    </div>
  );
}

function Sec3({ form, set, suggesting, onSuggest }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
          Apresente as razões que justificam a necessidade da contratação, incluindo o problema a ser resolvido, o interesse público atendido e as consequências da não contratação.
        </p>
      </div>
      <FL label="Justificativa da Contratação" req campo="justificativa" suggesting={suggesting} onSuggest={onSuggest}
        tip="Motivação técnica e administrativa da contratação, com fundamento na necessidade do serviço público.">
        <Textarea
          rows={12}
          className="text-sm resize-none"
          value={form.justificativa}
          onChange={e => set("justificativa", e.target.value)}
          placeholder="Justifique a necessidade da contratação:&#10;&#10;1. Contexto e problema identificado:&#10;&#10;2. Consequências da não contratação:&#10;&#10;3. Interesse público atendido:&#10;&#10;4. Fundamentação legal:"
        />
      </FL>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
        <span>{form.justificativa.length} caracteres</span>
        <span>{form.justificativa.split(/\s+/).filter(Boolean).length} palavras</span>
      </div>
    </div>
  );
}

type DFDItem = { id: string; descricao: string; unidade: string; quantidade: string; valorUnitario: string };

type Sec4Props = SectionProps & {
  items: DFDItem[];
  total: number;
  estimating: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof DFDItem, value: string) => void;
  onEstimar: () => void;
};

function Sec4({ form, set, items, total, estimating, onAdd, onRemove, onUpdate, onEstimar }: Sec4Props) {
  const temItens = items.some(i => i.descricao.trim());
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        {/* Table header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Table2 className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Descrição dos Itens e Quantitativos</p>
              <p className="text-[10px] text-muted-foreground">Seq, descrição, unidade, quantidade e valor estimado por item</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="default" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={onAdd} type="button">
              <Plus className="h-3.5 w-3.5" /> Adicionar Item
            </Button>
            <Button size="sm" variant="outline"
              className="h-8 text-xs gap-1.5 border-blue-400/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-400"
              onClick={onEstimar} disabled={estimating || !temItens} type="button">
              {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {estimating ? "Estimando..." : "Estimar com IA"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b-2 border-border">
                <th className="text-center py-3 px-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-10">Seq</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider min-w-[220px]">Descrição do Item</th>
                <th className="text-center py-3 px-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-20">Unid.</th>
                <th className="text-center py-3 px-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-20">Qtd</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-36">Valor Unit. (R$)</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-32">Total (R$)</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const qty = parseFloat(item.quantidade.replace(",", ".")) || 0;
                const unit = parseFloat(item.valorUnitario.replace(/\./g, "").replace(",", ".")) || 0;
                const rowTotal = qty * unit;
                return (
                  <tr key={item.id} className={`border-b border-border transition-colors group ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-blue-500/5`}>
                    <td className="py-3 px-3 text-center">
                      <span className="text-xs font-mono font-semibold text-muted-foreground">{idx + 1}</span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="rounded-lg border border-border bg-background focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all min-h-[72px] flex">
                        <textarea rows={3}
                          className="w-full text-sm bg-transparent px-3 py-2.5 resize-none outline-none placeholder:text-muted-foreground/40 leading-snug"
                          value={item.descricao}
                          onChange={e => { onUpdate(item.id, "descricao", e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                          placeholder="Descrição detalhada do item ou serviço..." />
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className="rounded-lg border border-border bg-background focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all h-[72px] flex items-center">
                        <Input className="h-full text-sm text-center bg-transparent border-0 shadow-none focus-visible:ring-0 px-2 font-medium"
                          value={item.unidade} onChange={e => onUpdate(item.id, "unidade", e.target.value)} placeholder="UN" />
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className="rounded-lg border border-border bg-background focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all h-[72px] flex items-center">
                        <Input className="h-full text-sm text-center bg-transparent border-0 shadow-none focus-visible:ring-0 px-2 font-medium"
                          value={item.quantidade} onChange={e => onUpdate(item.id, "quantidade", e.target.value)} placeholder="1" />
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className="rounded-lg border border-border bg-background focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all h-[72px] flex items-center">
                        <Input className="h-full text-sm text-right font-mono bg-transparent border-0 shadow-none focus-visible:ring-0 px-3"
                          value={item.valorUnitario} onChange={e => onUpdate(item.id, "valorUnitario", e.target.value)} placeholder="0,00" />
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className={`rounded-lg h-[72px] flex items-center justify-end px-3 text-sm font-mono font-semibold
                        ${rowTotal > 0 ? "bg-blue-500/8 border border-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-muted/20 border border-border text-muted-foreground/30"}`}>
                        {rowTotal > 0 ? rowTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <button type="button" onClick={() => onRemove(item.id)}
                        className="w-8 h-8 mt-[20px] rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mx-auto">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t-2 border-border bg-blue-500/5">
            <span className="text-sm font-semibold text-foreground">Valor Estimado Total</span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400 font-mono">
                R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10" type="button"
                onClick={() => set("valorEstimado", total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}>
                Usar como valor estimado ↑
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FL label="Valor Estimado Total (R$)" req tip="Valor total estimado para fins de planejamento orçamentário">
          <Input value={form.valorEstimado} onChange={e => set("valorEstimado", e.target.value)} placeholder="Ex: 9.178,05" className="font-mono" />
        </FL>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function DFDGeneratorPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState(1);
  const [form, setForm] = useState<DFDForm>(FORM0);
  const [aiContent, setAiContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [attachedReports, setAttachedReports] = useState<UploadedReport[]>([]);
  const [items, setItems] = useState<DFDItem[]>([
    { id: "1", descricao: "", unidade: "UN", quantidade: "1", valorUnitario: "" },
  ]);

  const set = useCallback((field: keyof DFDForm, v: string) => {
    setForm(p => ({ ...p, [field]: v }));
  }, []);

  const addItem = useCallback(() => {
    setItems(p => [...p, { id: Date.now().toString(), descricao: "", unidade: "UN", quantidade: "1", valorUnitario: "" }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);
  }, []);

  const updateItem = useCallback((id: string, field: keyof DFDItem, value: string) => {
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));
  }, []);

  const total = useMemo(() => items.reduce((sum, item) => {
    const qty = parseFloat(item.quantidade.replace(",", ".")) || 0;
    const unit = parseFloat(item.valorUnitario.replace(/\./g, "").replace(",", ".")) || 0;
    return sum + qty * unit;
  }, 0), [items]);

  const sectionStatus = useMemo(() => SECTIONS.map(s => {
    const filled = s.required.filter(f => form[f as keyof DFDForm]?.trim());
    return { filled: filled.length, total: s.required.length };
  }), [form]);

  const pct = useMemo(() => {
    const all = SECTIONS.flatMap(s => s.required);
    const filled = all.filter(f => form[f as keyof DFDForm]?.trim());
    return Math.round((filled.length / all.length) * 100);
  }, [form]);

  const words = aiContent ? aiContent.split(/\s+/).filter(Boolean).length : 0;

  const handleEstimar = useCallback(async () => {
    const validos = items.filter(i => i.descricao.trim());
    if (!validos.length) { toast.warning("Adicione ao menos um item com descrição."); return; }
    setEstimating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          tipo: "cotacao",
          formData: { itens: validos.map(i => ({ descricao: `${i.descricao} — ${i.quantidade} ${i.unidade}` })), margem: 15, impostos: 8.65 },
        }),
      });
      const data = JSON.parse(await res.text());
      if (data.itens?.length) {
        setItems(prev => {
          const validosIds = validos.map(v => v.id);
          let aiIdx = 0;
          return prev.map(item => {
            if (!validosIds.includes(item.id)) return item;
            const aiItem = data.itens[aiIdx++];
            if (!aiItem) return item;
            const mid = ((aiItem.faixaMin ?? 0) + (aiItem.faixaMax ?? 0)) / 2;
            return { ...item, valorUnitario: mid > 0 ? mid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.valorUnitario };
          });
        });
        toast.success("Estimativa aplicada na tabela!");
      } else {
        toast.error(data.error || "Resposta inválida da IA.");
      }
    } catch { toast.error("Erro ao estimar preços."); }
    finally { setEstimating(false); }
  }, [items]);

  const handleSuggest = useCallback(async (campo: string) => {
    setSuggesting(campo);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ tipo: "sugestao", formData: { campo, tipoDocumento: "DFD", contexto: form } }),
      });
      const data = await res.json();
      if (data.conteudo) { setForm(p => ({ ...p, [campo]: data.conteudo })); toast.success("Sugestão aplicada!"); }
    } catch { toast.error("Erro ao sugerir."); }
    finally { setSuggesting(null); }
  }, [form]);

  const handleGenerate = useCallback(async () => {
    if (pct < 30) { toast.warning("Preencha pelo menos os campos obrigatórios essenciais."); return; }
    setGenerating(true);
    setAiContent("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ tipo: "dfd", formData: { ...form, itens: items }, stream: true }),
      });
      if (!res.ok) throw new Error("Falha");
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let acc = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const j = JSON.parse(line.slice(6));
                if (j.type === "content_block_delta" && j.delta?.text) { acc += j.delta.text; setAiContent(acc); }
              } catch {}
            }
          }
        }
        toast.success("DFD gerado com sucesso!");
      }
    } catch { toast.error("Erro ao gerar o DFD. Tente novamente."); }
    finally { setGenerating(false); }
  }, [form, items, pct]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const { data: saved, error } = await supabase.from("documents").insert({
        user_id: user.id,
        tipo: "dfd",
        titulo: `DFD — ${form.objeto?.slice(0, 60) || form.secretaria || "Sem objeto"}`,
        orgao: form.secretaria,
        objeto: form.objeto,
        conteudo: aiContent,
        form_data: { ...form, itens: items },
        status: aiContent ? "finalizado" : "rascunho",
      }).select("id").single();
      if (error) throw error;
      const ready = attachedReports.filter(r => !r.uploading && r.filePath);
      if (saved && ready.length > 0) {
        await supabase.from("document_attachments").insert(
          ready.map(r => ({
            document_id: saved.id, user_id: user.id,
            tipo: "relatorio_historico", file_name: r.fileName,
            file_path: r.filePath, file_size: r.size, ano_referencia: r.ano,
          }))
        );
      }
      toast.success("DFD salvo com sucesso!");
    } catch (err: any) { toast.error(`Erro ao salvar: ${err?.message ?? "tente novamente."}`); }
    finally { setSaving(false); }
  };

  const handleExport = (format: "pdf" | "docx" = "pdf") => {
    if (!aiContent) return;
    const opts = {
      documentTitle: `DFD — ${form.objeto?.slice(0, 60) || form.secretaria || "Documento de Formalização da Demanda"}`,
      orgao: form.secretaria,
      legalBasis: "Lei nº 14.133/2021 · Art. 12",
      sections: [{ title: "", isMarkdown: true, content: aiContent }],
    };
    if (format === "docx") exportAsDocx(opts); else exportAsPdf(opts);
  };

  const handleCopy = () => {
    if (!aiContent) return;
    navigator.clipboard.writeText(aiContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyForecast = (forecast: ForecastData) => {
    if (forecast.objeto) set("objeto", forecast.objeto);
    if (forecast.justificativa) set("justificativa", forecast.justificativa);
    if (forecast.valorTotal > 0) set("valorEstimado", forecast.valorTotal.toFixed(2));
    if (forecast.itens.length > 0) {
      setItems(forecast.itens.map(item => ({
        id: crypto.randomUUID(),
        descricao: item.descricao,
        unidade: item.unidade || "UN",
        quantidade: String(item.quantidade),
        valorUnitario: item.valorUnitario > 0 ? item.valorUnitario.toFixed(2) : "",
      })));
    }
  };

  const handleGerarETP = () => {
    sessionStorage.setItem("dfd_prefill", JSON.stringify({
      unidade: form.secretaria,
      setor: form.setor,
      responsavel: form.responsavel,
      cargo: form.cargo,
      oQueSeraContratado: form.objeto,
      descricaoNecessidade: form.justificativa,
      valorEstimado: form.valorEstimado,
    }));
    toast.info("Abrindo gerador de ETP com os dados do DFD...", { duration: 3000 });
    navigate("/dashboard/etp");
  };

  const cur = SECTIONS[section - 1];
  const CurIcon = cur.icon;
  const sectionProps: SectionProps = { form, set, suggesting, onSuggest: handleSuggest };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Documento de Formalização da Demanda</h1>
              <p className="text-xs text-muted-foreground">DFD · Art. 12, VII · Lei 14.133/2021 · Etapa que precede o ETP</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={pct >= 80 ? "default" : "secondary"} className="text-xs font-mono">{pct}% completo</Badge>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !form.secretaria}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Salvar
            </Button>
            {aiContent && (
              <Button variant="outline" size="sm" onClick={handleGerarETP} className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Gerar ETP a partir deste DFD
              </Button>
            )}
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? "Gerando..." : "Gerar DFD com IA"}
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full bg-blue-600 rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{pct}% dos campos obrigatórios preenchidos</span>
            <span>{sectionStatus.filter(s => s.filled === s.total).length}/{SECTIONS.length} seções completas</span>
          </div>
        </div>

        {/* Relatórios históricos + previsão IA */}
        <HistoricalReportsSection
          documentType="dfd"
          orgao={form.secretaria}
          accent="blue"
          onApply={handleApplyForecast}
          onReportsChange={setAttachedReports}
        />

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_380px] gap-4">

          {/* Sidebar nav */}
          <nav className="rounded-xl border border-border bg-card p-2 h-fit lg:sticky lg:top-20">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Seções do DFD</p>
            <div className="space-y-0.5">
              {SECTIONS.map((s, idx) => {
                const Icon = s.icon;
                const st = sectionStatus[idx];
                const done = st.filled === st.total;
                const active = section === s.id;
                return (
                  <button key={s.id} onClick={() => setSection(s.id)}
                    className={cn("w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all",
                      active ? "bg-blue-500/10" : done ? "hover:bg-emerald-500/5" : "hover:bg-secondary")}>
                    <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                      {done && !active ? <Check className="h-3 w-3" /> : s.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium", active ? "text-blue-600" : done ? "text-emerald-500" : "text-muted-foreground")}>{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{st.filled}/{st.total} obr.</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Info block */}
            <div className="mt-4 pt-3 border-t border-border px-3 pb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fluxo Lei 14.133/2021</p>
              {[
                { label: "DFD", desc: "Formaliza a demanda", active: true },
                { label: "ETP", desc: "Estudo técnico", active: false },
                { label: "TR", desc: "Termo de referência", active: false },
              ].map(item => (
                <div key={item.label} className={cn("flex items-center gap-2 py-1", item.active ? "text-blue-600" : "text-muted-foreground/50")}>
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", item.active ? "bg-blue-600" : "bg-muted-foreground/30")} />
                  <span className="text-[10px] font-semibold w-6">{item.label}</span>
                  <span className="text-[10px]">{item.desc}</span>
                </div>
              ))}
            </div>
          </nav>

          {/* Form */}
          <div className="rounded-xl border border-border bg-card flex flex-col min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div key={section} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}
                className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 shrink-0">
                    <CurIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{cur.title}</h2>
                    <p className="text-xs text-muted-foreground">{cur.ref}</p>
                  </div>
                </div>
                {section === 1 && <Sec1 {...sectionProps} />}
                {section === 2 && <Sec2 {...sectionProps} />}
                {section === 3 && <Sec3 {...sectionProps} />}
                {section === 4 && <Sec4 {...sectionProps} items={items} total={total} estimating={estimating} onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} onEstimar={handleEstimar} />}
              </motion.div>
            </AnimatePresence>

            {/* Nav footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setSection(s => Math.max(1, s - 1))} disabled={section === 1}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <div className="flex items-center gap-1">
                {SECTIONS.map((_, i) => {
                  const done = sectionStatus[i]?.filled === sectionStatus[i]?.total;
                  return (
                    <button key={i} onClick={() => setSection(i + 1)}
                      className={cn("rounded-full transition-all", section === i + 1 ? "h-2 w-4 bg-blue-600" : done ? "h-2 w-2 bg-emerald-500" : "h-2 w-2 bg-muted-foreground/30")} />
                  );
                })}
              </div>
              {section < 4 ? (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setSection(s => s + 1)}>
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                  Gerar DFD
                </Button>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className={cn("rounded-xl border border-border bg-card flex flex-col", fullscreen && "fixed inset-4 z-50 shadow-2xl")}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-medium">Preview</span>
                {aiContent && <span className="text-xs text-muted-foreground">· {words.toLocaleString()} palavras</span>}
              </div>
              <div className="flex items-center gap-1">
                {aiContent && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleExport("pdf")}>
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleExport("docx")}>
                      <Download className="h-3.5 w-3.5" /> Word
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFullscreen(v => !v)}>
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm min-h-[500px]">
              {generating ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Claude está redigindo o DFD...
                  </div>
                  {aiContent && (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&>h1]:text-sm [&>h2]:text-xs [&>h3]:text-xs [&>p]:text-xs [&>p]:leading-relaxed [&>ul]:text-xs [&>ol]:text-xs">
                      <ReactMarkdown>{aiContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ) : aiContent ? (
                <div className="prose prose-sm max-w-none dark:prose-invert
                  [&>h1]:text-sm [&>h1]:font-bold [&>h1]:mt-5 [&>h1]:mb-2
                  [&>h2]:text-xs [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-1.5
                  [&>h3]:text-xs [&>h3]:font-medium [&>h3]:mt-3 [&>h3]:mb-1
                  [&>p]:text-xs [&>p]:leading-relaxed
                  [&>ul]:text-xs [&>ul]:space-y-0.5
                  [&>ol]:text-xs [&>ol]:space-y-0.5
                  [&>table]:text-xs [&>table]:w-full
                  [&>blockquote]:border-l-2 [&>blockquote]:border-blue-500 [&>blockquote]:pl-3 [&>blockquote]:text-xs [&>blockquote]:text-muted-foreground">
                  <ReactMarkdown>{aiContent}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-3">
                  <div className="rounded-full bg-blue-600/10 p-4">
                    <FileText className="h-7 w-7 text-blue-600/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Nenhum documento gerado</p>
                    <p className="text-xs mt-1 text-muted-foreground max-w-[180px]">
                      Preencha as seções e clique em "Gerar DFD com IA"
                    </p>
                  </div>
                  {pct > 0 && (
                    <div className="text-xs text-left space-y-1 mt-1 w-full max-w-[200px]">
                      {form.secretaria && <p><span className="text-muted-foreground">Secretaria:</span> {form.secretaria}</p>}
                      {form.setor && <p><span className="text-muted-foreground">Setor:</span> {form.setor}</p>}
                      {form.prioridade && <p><span className="text-muted-foreground">Prioridade:</span> {form.prioridade}</p>}
                      {form.valorEstimado && <p><span className="text-muted-foreground">Valor est.:</span> R$ {form.valorEstimado}</p>}
                    </div>
                  )}
                  <div className="mt-2 p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground text-left max-w-[200px]">
                    <p className="font-semibold mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> O DFD precede o ETP
                    </p>
                    <p>Após gerar o DFD, use "Gerar ETP" para continuar o processo.</p>
                  </div>
                </div>
              )}
            </div>

            {aiContent && (
              <div className="px-4 py-2.5 border-t border-border shrink-0">
                <Button size="sm" variant="outline" className="w-full h-7 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1.5" onClick={handleGerarETP}>
                  <ArrowRight className="h-3.5 w-3.5" /> Gerar ETP a partir deste DFD
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <FloatingChat />
    </TooltipProvider>
  );
}
