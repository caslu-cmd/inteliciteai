import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Scale, Plus, Trash2, Zap, CheckCircle2, XCircle, Loader2, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LegalItem {
  id: string;
  title: string;
  source_type: string;
  reference: string | null;
  year: number | null;
  active: boolean;
  chunk_count?: number;
}

const SOURCE_TYPES = [
  { value: "lei",                  label: "Lei" },
  { value: "acordao_tcu",          label: "Acórdão TCU" },
  { value: "sumula_tcu",           label: "Súmula TCU" },
  { value: "orientacao_agu",       label: "Orientação AGU" },
  { value: "instrucao_normativa",  label: "Instrução Normativa" },
  { value: "doutrina",             label: "Doutrina" },
  { value: "outro",                label: "Outro" },
];

const SOURCE_LABEL = (v: string) =>
  SOURCE_TYPES.find((s) => s.value === v)?.label ?? v;

export default function AdminBaseJuridicaTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<LegalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [indexingAll, setIndexingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    source_type: "lei",
    reference: "",
    year: new Date().getFullYear(),
    content: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: knowledge, error: kErr } = await supabase
      .from("legal_knowledge")
      .select("id, title, source_type, reference, year, active")
      .order("created_at", { ascending: true });

    if (kErr) console.error("[BaseJuridica] erro carregando knowledge:", kErr);

    const { data: chunks, error: cErr } = await supabase
      .from("legal_knowledge_chunks")
      .select("knowledge_id")
      .limit(10000);

    if (cErr) console.error("[BaseJuridica] erro carregando chunks:", cErr);

    console.log("[BaseJuridica] knowledge:", knowledge?.length, "chunks:", chunks?.length);

    const counts = new Map<string, number>();
    (chunks || []).forEach((c: any) => {
      counts.set(c.knowledge_id, (counts.get(c.knowledge_id) || 0) + 1);
    });

    setItems(
      (knowledge || []).map((k: any) => ({
        ...k,
        chunk_count: counts.get(k.id) || 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const indexOne = async (id: string) => {
    setIndexingId(id);
    try {
      const { error } = await supabase.functions.invoke("embed-legal", {
        body: { knowledgeId: id },
      });
      if (error) throw error;
      toast({ title: "✓ Item indexado" });
    } catch (err: any) {
      toast({ title: "Erro ao indexar", description: err.message, variant: "destructive" });
    } finally {
      setIndexingId(null);
      await fetchData(); // always reload to reflect any partial progress
    }
  };

  const indexAll = async () => {
    setIndexingAll(true);
    try {
      const { error } = await supabase.functions.invoke("embed-legal", {
        body: { indexAll: true },
      });
      if (error) throw error;
      toast({ title: "✓ Base jurídica indexada" });
    } catch (err: any) {
      toast({ title: "Erro ao indexar", description: err.message, variant: "destructive" });
    } finally {
      setIndexingAll(false);
      await fetchData();
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Deletar este item da base jurídica?")) return;
    await supabase.from("legal_knowledge_chunks").delete().eq("knowledge_id", id);
    const { error } = await supabase.from("legal_knowledge").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item removido" });
    fetchData();
  };

  const createItem = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("legal_knowledge").insert({
      title: form.title,
      source_type: form.source_type,
      reference: form.reference || null,
      year: Number(form.year) || null,
      content: form.content,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✓ Item adicionado" });
    setForm({ title: "", source_type: "lei", reference: "", year: new Date().getFullYear(), content: "" });
    setShowForm(false);
    fetchData();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-sm">Base Jurídica</h2>
          <span className="text-xs text-muted-foreground">({items.length} itens)</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="ghost"
            onClick={fetchData}
            disabled={loading}
            title="Atualizar"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo item
          </Button>
          <Button
            size="sm"
            onClick={indexAll}
            disabled={indexingAll || items.length === 0}
          >
            {indexingAll
              ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              : <Zap className="h-3.5 w-3.5 mr-1" />}
            Indexar tudo
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-5 space-y-3"
        >
          <p className="font-medium text-sm">Adicionar novo item à base</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tipo de fonte</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ano</Label>
                <Input
                  type="number" value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Referência</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Ex: Art. 1º — Lei 14.133/2021"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Conteúdo</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                placeholder="Texto integral que será dividido em chunks e embedado..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={createItem} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </motion.div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum item na base jurídica</p>
          </div>
        ) : (
          items.map((item) => {
            const indexed = (item.chunk_count || 0) > 0;
            return (
              <div
                key={item.id}
                className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center px-4 sm:px-5 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors"
              >
                <div className="sm:col-span-5 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.reference || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2 text-xs">
                  <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium">
                    {SOURCE_LABEL(item.source_type)}
                  </span>
                  {item.year && <span className="ml-2 text-muted-foreground">{item.year}</span>}
                </div>
                <div className="sm:col-span-2">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-0.5",
                    indexed ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400",
                  )}>
                    {indexed
                      ? <><CheckCircle2 className="h-3 w-3" /> {item.chunk_count} chunks</>
                      : <><XCircle className="h-3 w-3" /> Não indexado</>}
                  </span>
                </div>
                <div className="sm:col-span-3 flex sm:justify-end gap-1">
                  <Button
                    variant={indexed ? "secondary" : "default"}
                    size="sm"
                    onClick={() => indexOne(item.id)}
                    disabled={indexingId === item.id || indexingAll}
                    className="h-7 text-xs"
                    title={indexed ? "Reindexar item" : "Indexar item"}
                  >
                    {indexingId === item.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : indexed ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    {indexed ? "Indexado" : "Indexar"}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => deleteItem(item.id)}
                    className="h-7 w-7"
                    title="Deletar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
