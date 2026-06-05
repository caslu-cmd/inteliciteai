import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Loader2, CheckCircle2, Clock, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Regulation {
  id: string;
  title: string;
  tipo: string;
  numero: string | null;
  year: number | null;
  active: boolean;
  created_at: string;
  _indexed?: boolean;
}

interface Props {
  orgaoId: string;
  orgaoName: string;
  open: boolean;
  onClose: () => void;
}

const TIPOS = [
  { value: "lei",                label: "Lei Municipal" },
  { value: "decreto",            label: "Decreto" },
  { value: "portaria",           label: "Portaria" },
  { value: "instrucao_normativa",label: "Instrução Normativa" },
  { value: "resolucao",          label: "Resolução" },
  { value: "outro",              label: "Outro" },
];

export default function AdminRegulamentosDialog({ orgaoId, orgaoName, open, onClose }: Props) {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", tipo: "decreto", numero: "", year: new Date().getFullYear(), content: "" });
  const { toast } = useToast();

  useEffect(() => { if (open) load(); }, [open, orgaoId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("municipality_regulations")
      .select("id, title, tipo, numero, year, active, created_at")
      .eq("municipality_id", orgaoId)
      .order("created_at", { ascending: false });

    // Verificar quais têm chunks indexados
    if (data && data.length > 0) {
      const { data: chunks } = await supabase
        .from("municipality_regulation_chunks")
        .select("regulation_id")
        .in("regulation_id", data.map(r => r.id));

      const indexed = new Set((chunks || []).map((c: any) => c.regulation_id));
      setRegulations(data.map(r => ({ ...r, _indexed: indexed.has(r.id) })));
    } else {
      setRegulations([]);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Título e conteúdo são obrigatórios", variant: "destructive" }); return;
    }
    setAdding(true);
    const { data, error } = await supabase.from("municipality_regulations").insert({
      municipality_id: orgaoId,
      title: form.title.trim(),
      tipo: form.tipo,
      numero: form.numero || null,
      year: form.year,
      content: form.content.trim(),
      active: true,
    }).select("id").single();

    if (error || !data) {
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
      setAdding(false); return;
    }

    // Indexar automaticamente
    await handleIndex(data.id, orgaoId, form.content.trim());
    setForm({ title: "", tipo: "decreto", numero: "", year: new Date().getFullYear(), content: "" });
    setShowForm(false);
    setAdding(false);
    load();
  };

  const handleIndex = async (regulationId: string, municipalityId: string, content?: string) => {
    setIndexing(regulationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let regulationContent = content;
      if (!regulationContent) {
        const { data: reg } = await supabase.from("municipality_regulations").select("content").eq("id", regulationId).single();
        regulationContent = reg?.content;
      }
      if (!regulationContent) { toast({ title: "Conteúdo não encontrado", variant: "destructive" }); return; }

      const res = await supabase.functions.invoke("embed-regulation", {
        body: { regulationId, municipalityId, content: regulationContent },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      toast({ title: "Regulamento indexado!", description: `Pronto para uso nos geradores.` });
      load();
    } catch (err) {
      toast({ title: "Erro ao indexar", description: String(err), variant: "destructive" });
    } finally {
      setIndexing(null);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("municipality_regulations").delete().eq("id", id);
    toast({ title: "Regulamento removido" });
    load();
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { getDocument } = await import("pdfjs-dist");
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      setForm(p => ({ ...p, content: text.trim(), title: p.title || file.name.replace(".pdf", "") }));
      toast({ title: "PDF carregado!", description: `${pdf.numPages} página(s) extraídas.` });
    } catch {
      toast({ title: "Erro ao ler PDF", variant: "destructive" });
    }
    e.target.value = "";
  };

  const tipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label || tipo;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Regulamentos — {orgaoName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Lista de regulamentos */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : regulations.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <FileText className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhum regulamento cadastrado</p>
              <p className="text-xs mt-1">Adicione decretos, leis municipais, portarias e INCOMs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {regulations.map(reg => (
                <div key={reg.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{reg.title}</p>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{tipoLabel(reg.tipo)}</Badge>
                      {reg.numero && <span className="text-[10px] text-muted-foreground">nº {reg.numero}</span>}
                      {reg.year && <span className="text-[10px] text-muted-foreground">{reg.year}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {reg._indexed
                        ? <><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Indexado</span></>
                        : <><Clock className="h-3 w-3 text-amber-500" /><span className="text-[10px] text-amber-600">Não indexado</span></>
                      }
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!reg._indexed && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1"
                        disabled={indexing === reg.id}
                        onClick={() => handleIndex(reg.id, orgaoId)}>
                        {indexing === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Indexar"}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(reg.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de novo regulamento */}
          {showForm && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Novo Regulamento</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Título *</Label>
                  <Input placeholder="Decreto nº 1.234 — Regulamento de Licitações" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Número</Label>
                  <Input placeholder="1.234/2024" value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano</Label>
                  <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Importar PDF</Label>
                  <label className="flex items-center gap-2 cursor-pointer h-9 px-3 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary/50 transition-colors">
                    <Upload className="h-4 w-4" /> Carregar PDF
                    <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Conteúdo do regulamento *</Label>
                <Textarea
                  placeholder="Cole ou importe o texto completo do decreto, lei ou portaria..."
                  className="min-h-[120px] text-xs font-mono resize-none"
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                />
                {form.content && <p className="text-[10px] text-muted-foreground">{form.content.length.toLocaleString()} caracteres</p>}
              </div>

              <Button className="w-full gap-2" onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Salvar e Indexar
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {regulations.filter(r => r._indexed).length}/{regulations.length} indexados
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
