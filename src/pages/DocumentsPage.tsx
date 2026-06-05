import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Search, Download, Eye, Trash2, FileText, Filter,
  Plus, Loader2, RefreshCw, BookOpen, AlertCircle, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportAsPdf, exportAsDocx } from "@/lib/exportDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface Doc {
  id: string;
  tipo: "etp" | "tr" | "dfd";
  titulo: string;
  orgao: string;
  objeto: string;
  conteudo: string;
  status: "rascunho" | "finalizado";
  created_at: string;
  updated_at: string;
}

interface Attachment {
  id: string;
  document_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  ano_referencia?: number | null;
  tipo: string;
  created_at: string;
}

const tipoLabel: Record<string, string> = { etp: "ETP", tr: "TR", dfd: "DFD" };
const tipoColor: Record<string, string> = {
  etp: "bg-amber-500/10 text-amber-600",
  tr:  "bg-primary/10 text-primary",
  dfd: "bg-blue-600/10 text-blue-600",
};
const statusColors: Record<string, string> = {
  finalizado: "bg-success/10 text-success",
  rascunho:   "bg-muted/60 text-muted-foreground",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, tipo, titulo, orgao, objeto, conteudo, status, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const docs = (data as Doc[]) || [];
      setDocs(docs);
      if (docs.length > 0) {
        await loadAttachments(docs.map(d => d.id));
      }
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (docIds: string[]) => {
    const { data } = await supabase
      .from("document_attachments")
      .select("*")
      .in("document_id", docIds)
      .order("created_at", { ascending: true });
    if (!data) return;
    const map: Record<string, Attachment[]> = {};
    for (const att of data as Attachment[]) {
      if (!map[att.document_id]) map[att.document_id] = [];
      map[att.document_id].push(att);
    }
    setAttachments(map);
  };

  const handleOpenFile = async (att: Attachment) => {
    setOpeningFile(att.id);
    try {
      const { data, error } = await supabase.storage
        .from("historical-reports")
        .createSignedUrl(att.file_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao abrir o arquivo. Tente novamente.");
    } finally {
      setOpeningFile(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setAttachments(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (viewDoc?.id === id) setViewDoc(null);
      toast.success("Documento excluído");
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = (doc: Doc, format: "pdf" | "docx" = "pdf") => {
    const opts = {
      documentTitle: doc.titulo,
      orgao: doc.orgao,
      legalBasis: "Lei nº 14.133/2021",
      sections: [
        ...(doc.objeto ? [{ title: "Objeto da Contratação", isMarkdown: false, content: doc.objeto }] : []),
        { title: "", isMarkdown: true, content: doc.conteudo },
      ],
    };
    if (format === "docx") exportAsDocx(opts);
    else exportAsPdf(opts);
  };

  const filtered = docs.filter((d) => {
    const matchSearch =
      d.titulo.toLowerCase().includes(search.toLowerCase()) ||
      d.objeto.toLowerCase().includes(search.toLowerCase()) ||
      d.orgao.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || d.tipo === typeFilter;
    return matchSearch && matchType;
  });

  const viewDocAttachments = viewDoc ? (attachments[viewDoc.id] || []) : [];

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <FolderOpen className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Meus Documentos</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Carregando…" : `${docs.length} documento${docs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadDocs} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link to="/dashboard/etp">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo ETP
            </Button>
          </Link>
          <Link to="/dashboard/tr">
            <Button variant="gold" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo TR
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, objeto ou órgão..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="etp">ETP</SelectItem>
            <SelectItem value="tr">TR</SelectItem>
            <SelectItem value="dfd">DFD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-dashed border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
            <BookOpen className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhum documento salvo</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Gere seu primeiro ETP ou TR com IA e salve para acessar aqui depois.
          </p>
          <div className="flex gap-3">
            <Link to="/dashboard/etp">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" /> Gerar ETP
              </Button>
            </Link>
            <Link to="/dashboard/tr">
              <Button variant="gold" className="gap-2">
                <FileText className="h-4 w-4" /> Gerar TR
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">Nenhum documento encontrado para esta busca</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-5">Documento</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">Criado</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>
          <AnimatePresence>
            {filtered.map((doc, i) => {
              const docAtts = attachments[doc.id] || [];
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-12 gap-4 items-center border-b border-border px-4 py-3 hover:bg-secondary/30 transition-colors last:border-b-0"
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${tipoColor[doc.tipo] || "bg-accent/10 text-accent"}`}>
                      {tipoLabel[doc.tipo] || doc.tipo.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.titulo}</p>
                      <div className="flex items-center gap-2">
                        {doc.orgao && <p className="text-xs text-muted-foreground truncate">{doc.orgao}</p>}
                        {docAtts.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                            <Paperclip className="h-2.5 w-2.5" />
                            {docAtts.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                      {tipoLabel[doc.tipo] || doc.tipo.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">{fmtDate(doc.created_at)}</div>
                  <div className="col-span-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[doc.status]}`}>
                      {doc.status}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDoc(doc)} title="Visualizar">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExport(doc)} title="Exportar PDF">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      title="Excluir">
                      {deleting === doc.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* View Document Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={(open) => !open && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${viewDoc ? tipoColor[viewDoc.tipo] : ""}`}>
                {viewDoc ? tipoLabel[viewDoc.tipo] : ""}
              </div>
              {viewDoc?.titulo}
            </DialogTitle>
          </DialogHeader>
          {viewDoc && (
            <div className="flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
              {/* Meta row */}
              <div className="flex flex-wrap gap-2 text-xs shrink-0">
                {viewDoc.orgao && <span className="bg-secondary px-2 py-1 rounded-md">{viewDoc.orgao}</span>}
                <span className="bg-secondary px-2 py-1 rounded-md">{fmtDate(viewDoc.created_at)}</span>
                <span className={`rounded-full px-2 py-1 font-semibold ${statusColors[viewDoc.status]}`}>
                  {viewDoc.status}
                </span>
              </div>

              {/* Attachments section */}
              {viewDocAttachments.length > 0 && (
                <div className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                    Relatórios analisados:
                  </p>
                  {viewDocAttachments.map(att => (
                    <button
                      key={att.id}
                      onClick={() => handleOpenFile(att)}
                      disabled={openingFile === att.id}
                      className="flex items-center gap-2 w-full text-left group disabled:opacity-60"
                    >
                      {openingFile === att.id
                        ? <Loader2 className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-spin" />
                        : <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      }
                      <span className="text-sm text-amber-700 dark:text-amber-400 group-hover:underline underline-offset-2 truncate">
                        {att.file_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Document content */}
              <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-4 min-h-0">
                {viewDoc.conteudo ? (
                  <div className="prose prose-sm max-w-none text-foreground [&>p]:leading-relaxed [&>ul]:space-y-1">
                    <ReactMarkdown>{viewDoc.conteudo}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewDoc.objeto && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Objeto</p>
                        <p className="text-sm">{viewDoc.objeto}</p>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground italic">Documento em rascunho — sem conteúdo gerado pela IA.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 shrink-0 flex-wrap">
                <Button variant="outline" onClick={() => setViewDoc(null)}>Fechar</Button>
                <Button variant="outline" onClick={() => handleExport(viewDoc, "docx")} className="gap-2">
                  <Download className="h-4 w-4" /> Word (.doc)
                </Button>
                <Button onClick={() => handleExport(viewDoc, "pdf")} className="gap-2">
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
