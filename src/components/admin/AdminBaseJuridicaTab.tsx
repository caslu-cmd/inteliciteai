import { useState, useEffect } from "react";
import { Scale, Plus, Trash2, Loader2, CheckCircle2, Clock, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LegalItem {
  id: string;
  title: string;
  source_type: string;
  reference: string | null;
  year: number | null;
  active: boolean;
  created_at: string;
  _indexed?: boolean;
}

const SOURCE_TYPES = [
  { value: "lei",                 label: "Lei / Artigos" },
  { value: "acordao_tcu",        label: "Acórdão TCU" },
  { value: "sumula_tcu",         label: "Súmula TCU" },
  { value: "orientacao_agu",     label: "Orientação AGU" },
  { value: "instrucao_normativa",label: "Instrução Normativa" },
  { value: "doutrina",           label: "Doutrina" },
  { value: "outro",              label: "Outro" },
];

const SOURCE_COLORS: Record<string, string> = {
  lei: "bg-blue-500/10 text-blue-600",
  acordao_tcu: "bg-amber-500/10 text-amber-600",
  sumula_tcu: "bg-orange-500/10 text-orange-600",
  orientacao_agu: "bg-green-500/10 text-green-600",
  instrucao_normativa: "bg-purple-500/10 text-purple-600",
  doutrina: "bg-pink-500/10 text-pink-600",
  outro: "bg-secondary text-muted-foreground",
};

export default function AdminBaseJuridicaTab() {
  const [items, setItems] = useState<LegalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState<string | "all" | null>(null);
  const [form, setForm] = useState({ title: "", source_type: "lei", reference: "", year: new Date().getFullYear(), content: "" });
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("legal_knowledge").select("id, title, source_type, reference, year, active, created_at").order("source_type").order("created_at");
    if (data) {
      const { data: chunks } = await supabase.from("legal_knowledge_chunks").select("knowledge_id");
      const indexed = new Set((chunks || []).map((c: any) => c.knowledge_id));
      setItems(data.map(i => ({ ...i, _indexed: indexed.has(i.id) })));
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Título e conteúdo são obrigatórios", variant: "destructive" }); return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("legal_knowledge").insert({
      title: form.title.trim(),
      source_type: form.source_type,
      reference: form.reference || null,
      year: form.year,
      content: form.content.trim(),
      active: true,
    }).select("id").single();

    if (error || !data) {
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
      setSaving(false); return;
    }
    await handleIndex(data.id);
    setForm({ title: "", source_type: "lei", reference: "", year: new Date().getFullYear(), content: "" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleIndex = async (id: string) => {
    setIndexing(id);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await supabase.functions.invoke("embed-legal", {
        body: { knowledgeId: id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      toast({ title: "Indexado com sucesso!" });
      load();
    } catch (err) {
      toast({ title: "Erro ao indexar", description: String(err), variant: "destructive" });
    } finally { setIndexing(null); }
  };

  const handleIndexAll = async () => {
    setIndexing("all");
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await supabase.functions.invoke("embed-legal", {
        body: { indexAll: true },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      toast({ title: "Toda a base indexada!", description: `${res.data?.chunks || 0} chunks gerados.` });
      load();
    } catch (err) {
      toast({ title: "Erro ao indexar", description: String(err), variant: "destructive" });
    } finally { setIndexing(null); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("legal_knowledge").delete().eq("id", id);
    toast({ title: "Item removido" });
    load();
  };

  const sourceLabel = (type: string) => SOURCE_TYPES.find(s => s.value === type)?.label || type;
  const notIndexed = items.filter(i => !i._indexed).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-accent" /> Base Jurídica</h2>
          <p className="text-sm text-muted-foreground">Lei 14.133/2021, acórdãos TCU, orientações AGU e doutrina</p>
        </div>
        <div className="flex gap-2">
          {notIndexed > 0 && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleIndexAll} disabled={indexing === "all"}>
              {indexing === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Indexar tudo ({notIndexed})
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {SOURCE_TYPES.slice(0, 4).map(s => {
          const count = items.filter(i => i.source_type === s.value).length;
          return (
            <div key={s.value} className="rounded-lg border border-border bg-card px-4 py-3 text-center">
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-5">Título</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-2">Referência</div>
          <div className="col-span-1">Ano</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>
        {items.map(item => (
          <div key={item.id} className="grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
            <div className="col-span-5 flex items-center gap-2 min-w-0">
              <div className="shrink-0">
                {item._indexed
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  : <Clock className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              <p className="text-sm truncate">{item.title}</p>
            </div>
            <div className="col-span-2">
              <Badge className={`text-[10px] ${SOURCE_COLORS[item.source_type] || ""}`}>{sourceLabel(item.source_type)}</Badge>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">{item.reference || "—"}</div>
            <div className="col-span-1 text-sm text-muted-foreground">{item.year || "—"}</div>
            <div className="col-span-2 flex justify-end gap-1">
              {!item._indexed && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={indexing === item.id} onClick={() => handleIndex(item.id)}>
                  {indexing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Indexar"}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Novo item jurídico</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input placeholder="Lei 14.133/2021 — Artigos sobre ETP" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.source_type} onValueChange={v => setForm(p => ({ ...p, source_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referência</Label>
              <Input placeholder="Art. 18, §1º ou Acórdão 2622/2013-TCU" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Conteúdo *</Label>
            <Textarea
              placeholder="Cole o texto completo do artigo, acórdão ou orientação..."
              className="min-h-[140px] text-xs font-mono resize-none"
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            />
            {form.content && <p className="text-[10px] text-muted-foreground">{form.content.length.toLocaleString()} caracteres</p>}
          </div>
          <Button className="w-full gap-2" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvar e Indexar
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Para ativar busca web de jurisprudência em tempo real, adicione o secret <code className="bg-secondary px-1 rounded">BRAVE_SEARCH_API_KEY</code> no Supabase.
      </p>
    </div>
  );
}
