import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Plus, Eye, Download, Copy, Clock, CheckCircle2,
  PenLine, Send, Scale, HelpCircle, Loader2, AlertTriangle,
  X, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

interface Minuta {
  id: string;
  tipo: "impugnacao" | "esclarecimento";
  titulo: string;
  edital: string;
  orgao: string;
  clausula: string;
  base_legal: string;
  conteudo: string;
  status: "rascunho" | "gerado" | "assinado" | "protocolado";
  version: number;
  created_at: string;
  updated_at: string;
}

const statusCfg = {
  rascunho:    { label: "Rascunho",    icon: PenLine,      cls: "text-muted-foreground bg-muted/50"   },
  gerado:      { label: "Gerado",      icon: CheckCircle2, cls: "text-success bg-success/10"           },
  assinado:    { label: "Assinado",    icon: CheckCircle2, cls: "text-primary bg-primary/10"           },
  protocolado: { label: "Protocolado", icon: Send,         cls: "text-primary bg-primary/10"           },
};

const typeCfg = {
  impugnacao:    { label: "Impugnação",    icon: Scale,       cls: "text-destructive bg-destructive/10" },
  esclarecimento: { label: "Esclarecimento", icon: HelpCircle, cls: "text-amber-400 bg-amber-400/10"   },
};

const NEXT_STATUS: Record<string, string> = {
  gerado: "assinado", assinado: "protocolado",
};

export default function MinutasPage() {
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [filter, setFilter] = useState("todos");
  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTipo, setFormTipo] = useState<"impugnacao" | "esclarecimento">("impugnacao");
  const [edital, setEdital] = useState("");
  const [orgao, setOrgao] = useState("");
  const [clausula, setClausula] = useState("");
  const [motivo, setMotivo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Minuta | null>(null);

  const loadMinutas = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("minutas")
      .select("*")
      .order("created_at", { ascending: false });
    setMinutas((data as Minuta[]) || []);
    setLoadingList(false);
  };

  useEffect(() => { loadMinutas(); }, []);

  const generate = async () => {
    if (!edital.trim() || !clausula.trim()) {
      setGenError("Preencha o número do edital e a cláusula questionada.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-minuta`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ tipo: formTipo, edital, orgao, clausula, motivo }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

      const userId = session?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      // Save to Supabase
      const { data: saved, error: saveErr } = await supabase
        .from("minutas")
        .insert({
          user_id: userId,
          tipo: formTipo,
          titulo: json.titulo,
          edital,
          orgao,
          clausula,
          base_legal: json.baseLegal,
          conteudo: json.conteudo,
          status: "gerado",
        })
        .select()
        .single();

      if (saveErr) throw new Error(saveErr.message);

      setPreview(saved as Minuta);
      setShowForm(false);
      setEdital(""); setOrgao(""); setClausula(""); setMotivo("");
      loadMinutas();
    } catch (err: any) {
      setGenError(err.message || "Falha ao gerar documento");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("minutas").update({ status }).eq("id", id);
    setMinutas((prev) => prev.map((m) => m.id === id ? { ...m, status: status as Minuta["status"] } : m));
    if (preview?.id === id) setPreview((p) => p ? { ...p, status: status as Minuta["status"] } : p);
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  const downloadTxt = (minuta: Minuta) => {
    const blob = new Blob([minuta.conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${minuta.titulo.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = minutas.filter((m) => filter === "todos" || m.tipo === filter);

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Minutas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Impugnações e esclarecimentos gerados por Claude AI</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 text-sm" onClick={() => { setFormTipo("impugnacao"); setShowForm(true); }}>
              <Scale className="w-4 h-4" /> Nova Impugnação
            </Button>
            <Button className="gap-2 text-sm" onClick={() => { setFormTipo("esclarecimento"); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> Novo Esclarecimento
            </Button>
          </div>
        </div>

        {/* Generator form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-semibold text-base text-card-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Gerar {formTipo === "impugnacao" ? "Impugnação" : "Pedido de Esclarecimento"} com IA
                  </h3>
                  <button onClick={() => { setShowForm(false); setGenError(null); }}>
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>

                {/* Tipo selector */}
                <div className="flex gap-2 mb-5">
                  {(["impugnacao", "esclarecimento"] as const).map((t) => (
                    <button key={t} onClick={() => setFormTipo(t)}
                      className={`text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                        formTipo === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                      }`}>
                      {t === "impugnacao" ? "Impugnação" : "Esclarecimento"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Edital / Processo *</label>
                    <Input value={edital} onChange={(e) => setEdital(e.target.value)} placeholder="Ex: Pregão Eletrônico 045/2026 — Min. Saúde" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Órgão Licitante</label>
                    <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Ex: Ministério da Saúde" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cláusula / Item questionado *</label>
                    <Input value={clausula} onChange={(e) => setClausula(e.target.value)}
                      placeholder="Ex: Item 8.4.2 — exigência de certificação ISO 27001 obrigatória" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fundamentação adicional</label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
                      placeholder="Ex: A certificação não é necessária para o objeto contratado conforme Art. 67 §1º..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>

                {genError && (
                  <p className="text-sm text-destructive flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />{genError}
                  </p>
                )}

                <Button onClick={generate} disabled={generating} className="gap-2">
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando documento...</>
                    : <><Sparkles className="w-4 h-4" /> Gerar com Claude AI</>}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview panel */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-card border border-primary/30 rounded-xl shadow-card mb-6 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-primary/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-card-foreground">{preview.titulo}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg[preview.status].cls}`}>
                    {statusCfg[preview.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {NEXT_STATUS[preview.status] && (
                    <Button size="sm" variant="outline" className="text-xs gap-1"
                      onClick={() => updateStatus(preview.id, NEXT_STATUS[preview.status])}>
                      <Send className="w-3 h-3" />
                      Marcar como {statusCfg[NEXT_STATUS[preview.status] as keyof typeof statusCfg]?.label}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyText(preview.conteudo)} title="Copiar">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadTxt(preview)} title="Baixar .txt">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <button onClick={() => setPreview(null)} className="ml-1">
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>
              <pre className="p-5 text-xs text-card-foreground whitespace-pre-wrap leading-relaxed font-mono max-h-96 overflow-y-auto">
                {preview.conteudo}
              </pre>
              <div className="px-5 py-2 border-t border-border bg-muted/20">
                <p className="text-[10px] text-muted-foreground/60 font-mono">{preview.base_legal}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5">
          {[{ key: "todos", label: "Todos" }, { key: "impugnacao", label: "Impugnações" }, { key: "esclarecimento", label: "Esclarecimentos" }].map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`text-xs font-medium px-4 py-2 rounded-full border transition-colors ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
              }`}>
              {tab.label}
            </button>
          ))}
          {minutas.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{minutas.length} documento{minutas.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* List */}
        {loadingList ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma minuta ainda. Clique em "Nova Impugnação" ou "Novo Esclarecimento" para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((minuta, i) => {
              const status = statusCfg[minuta.status];
              const type   = typeCfg[minuta.tipo];
              const StatusIcon = status.icon;
              const TypeIcon   = type.icon;
              const isPreview  = preview?.id === minuta.id;
              return (
                <motion.div key={minuta.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`bg-card rounded-xl border shadow-card hover:shadow-card-hover transition-shadow ${isPreview ? "border-primary/40" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${type.cls}`}>
                          <TypeIcon className="w-3 h-3" />{type.label}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${status.cls}`}>
                          <StatusIcon className="w-3 h-3" />{status.label}
                        </span>
                        <span className="text-xs text-muted-foreground">v{minuta.version}</span>
                      </div>
                      <h3 className="font-semibold text-sm text-card-foreground mb-1 truncate">{minuta.titulo}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {minuta.orgao && <span>{minuta.orgao}</span>}
                        {minuta.base_legal && <span className="font-mono">{minuta.base_legal.substring(0, 50)}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(minuta.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar"
                        onClick={() => setPreview(isPreview ? null : minuta)}>
                        {isPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar"
                        onClick={() => copyText(minuta.conteudo)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar .txt"
                        onClick={() => downloadTxt(minuta)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {NEXT_STATUS[minuta.status] && (
                        <Button variant="outline" size="sm" className="text-xs h-8 gap-1 ml-1"
                          onClick={() => updateStatus(minuta.id, NEXT_STATUS[minuta.status])}>
                          <Send className="w-3 h-3" />
                          {statusCfg[NEXT_STATUS[minuta.status] as keyof typeof statusCfg]?.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </LicitanteLayout>
  );
}
