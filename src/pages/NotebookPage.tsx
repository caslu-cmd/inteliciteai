import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  BookOpen, Plus, Trash2, FileText, Send, Bot, User, Copy, RotateCcw,
  Sparkles, X, Eye, EyeOff, Wand2, AlertTriangle, Calendar,
  Loader2, CheckCheck, Upload, PenLine, Newspaper, Download,
  ChevronRight, MessageSquare, BookMarked, Search, Layers, Globe,
  Link2, ExternalLink, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/streamChat";
import { extractPdfText } from "@/lib/pdfExtract";
import { exportAsPdf } from "@/lib/exportDocument";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────
interface Source {
  id: string;
  title: string;
  content: string;
  type: "text" | "pdf" | "url" | "search";
  active: boolean;
  charCount: number;
  sourceUrl?: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// removed: checklist (ChecklistPage) and modalidade (DiagnosticPage)
type GeneratorType = "summary" | "prazos" | "riscos" | "perguntas";

interface GeneratedOutput {
  type: GeneratorType;
  content: string;
  generatedAt: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// ── Constants ─────────────────────────────────────────────────
const SOURCES_KEY = "intelicite_notebook_sources";
const uid = () => Math.random().toString(36).slice(2, 10);

const mapSource = (row: any): Source => ({
  id: row.id,
  title: row.title,
  content: row.content,
  type: row.type as Source["type"],
  active: row.active,
  charCount: row.char_count,
  sourceUrl: row.source_url ?? undefined,
  createdAt: row.created_at,
});
const nowStr = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const GENERATORS: {
  type: GeneratorType;
  label: string;
  description: string;
  icon: any;
  color: string;
  prompt: string;
}[] = [
  {
    type: "summary",
    label: "Resumo Jurídico",
    description: "Síntese executiva: objeto, valor, requisitos",
    icon: Newspaper,
    color: "text-blue-600",
    prompt:
      "Com base nos documentos fornecidos, redija um **Resumo Jurídico Executivo** completo cobrindo: (1) objeto da contratação, (2) valor estimado, (3) modalidade aplicável, (4) requisitos essenciais e (5) principais obrigações das partes. Use markdown com títulos e bullets. Cite artigos da Lei 14.133/2021 quando pertinente.",
  },
  {
    type: "prazos",
    label: "Mapa de Prazos",
    description: "Todos os prazos e obrigações em tabela",
    icon: Calendar,
    color: "text-amber-600",
    prompt:
      "Extraia e organize em tabela markdown **todos os prazos, datas-limite e obrigações temporais** presentes nos documentos. Colunas: | Prazo/Data | Descrição | Responsável | Base Legal |. Inclua prazos recursais, de habilitação, de entrega, de pagamento e qualquer outro prazo relevante. Se não houver data explícita, informe o prazo legal aplicável conforme Lei 14.133/2021.",
  },
  {
    type: "riscos",
    label: "Análise de Riscos",
    description: "Riscos jurídicos com nível de criticidade",
    icon: AlertTriangle,
    color: "text-red-600",
    prompt:
      "Realize uma **Análise de Riscos Jurídicos** dos documentos. Para cada risco: Descrição, Probabilidade (Alta/Média/Baixa), Impacto (Alto/Médio/Baixo), Base legal e Recomendação de mitigação. Organize do mais crítico ao menos crítico. Destaque cláusulas potencialmente nulas ou ilegais.",
  },
  {
    type: "perguntas",
    label: "Pedido de Esclarecimentos",
    description: "Perguntas técnicas para o órgão licitante",
    icon: HelpCircle,
    color: "text-purple-600",
    prompt:
      "Elabore um **Pedido de Esclarecimentos** completo para envio ao órgão licitante. Liste pontos ambíguos, contraditórios ou restritivos à competitividade. Formule cada pergunta de forma técnica, numeradas e referenciando o item/cláusula do documento. Inclua sugestão de como o órgão deveria responder.",
  },
];

const QUICK_ACTIONS = [
  "Qual a modalidade correta para este objeto?",
  "Liste todos os prazos recursais",
  "Há cláusulas restritivas à competitividade?",
  "O valor estimado está adequado ao mercado?",
  "Quais documentos de habilitação são exigidos?",
  "Esta dispensa tem fundamentação adequada?",
];

// ── Source type icons & labels ─────────────────────────────────
const SOURCE_TYPE_CONFIG = {
  text: { icon: PenLine, label: "Texto", color: "text-blue-500" },
  pdf: { icon: FileText, label: "PDF", color: "text-red-500" },
  url: { icon: Link2, label: "URL", color: "text-green-500" },
  search: { icon: Search, label: "Busca", color: "text-purple-500" },
};

// ── Build system prompt ───────────────────────────────────────
const buildSystemPrompt = (sources: Source[]) => {
  const active = sources.filter((s) => s.active);
  if (!active.length) return undefined;

  const docs = active
    .map(
      (s, i) =>
        `### [Fonte ${i + 1}] ${s.title} (${SOURCE_TYPE_CONFIG[s.type].label}${s.sourceUrl ? ` · ${s.sourceUrl}` : ""})\n\n${s.content}`
    )
    .join("\n\n---\n\n");

  return `Você é um assistente jurídico especializado em licitações públicas e na Lei 14.133/2021. Responda sempre em português do Brasil.

O usuário carregou os seguintes documentos/fontes para análise:

${docs}

---

Instruções:
- Cite as fontes pelo número ([Fonte 1], [Fonte 2], etc.)
- Cite artigos da Lei 14.133/2021 quando pertinente
- Para dados de preços/mercado encontrados nas fontes, destaque-os com valores e referências
- Use markdown para formatar respostas longas`;
};

// ── Web helpers (client-side, no edge function needed) ────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractTitle(html: string): string {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
}

// Fetch a URL via allorigins CORS proxy (no server needed)
async function fetchUrlContent(url: string): Promise<{ title: string; text: string; charCount: number }> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  // 1. Try edge function first (if deployed)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notebook-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ url }),
    });
    if (res.ok) return res.json();
  } catch { /* fall through */ }

  // 2. Fallback: allorigins.win CORS proxy
  const proxy = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  if (!proxy.ok) throw new Error(`Não foi possível acessar a URL (HTTP ${proxy.status})`);
  const json = await proxy.json();
  if (!json.contents) throw new Error("A página não retornou conteúdo legível");
  const title = extractTitle(json.contents) || new URL(url).hostname;
  const text = htmlToText(json.contents).slice(0, 50000);
  return { title, text, charCount: text.length };
}

// Search via DuckDuckGo JSON API (CORS-enabled, no key needed)
async function searchWeb(query: string): Promise<{ results: SearchResult[]; instantAnswer: string }> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  // 1. Try edge function first (if deployed)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notebook-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query }),
    });
    if (res.ok) return res.json();
  } catch { /* fall through */ }

  // 2. Fallback: DuckDuckGo JSON API (supports CORS from browsers)
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Erro ao buscar na web");
  const data = await res.json();

  const instantAnswer: string = data.AbstractText || data.Answer || "";

  const results: SearchResult[] = [];
  for (const topic of (data.RelatedTopics || []).slice(0, 8)) {
    if (topic.FirstURL && topic.Text) {
      try {
        const hostname = new URL(topic.FirstURL).hostname.replace("www.", "");
        results.push({
          title: topic.Text.split(" - ")[0]?.slice(0, 100) || topic.Text.slice(0, 80),
          url: topic.FirstURL,
          snippet: topic.Text,
          source: hostname,
        });
      } catch { /* skip */ }
    }
  }
  for (const r of (data.Results || []).slice(0, 5)) {
    if (r.FirstURL && r.Text) {
      try {
        const hostname = new URL(r.FirstURL).hostname.replace("www.", "");
        results.push({ title: r.Text.slice(0, 100), url: r.FirstURL, snippet: r.Text, source: hostname });
      } catch { /* skip */ }
    }
  }

  return { results, instantAnswer };
}

// ── Source Card ───────────────────────────────────────────────
const SourceCard = ({
  source,
  onToggle,
  onDelete,
}: {
  source: Source;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const cfg = SOURCE_TYPE_CONFIG[source.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
      className={cn(
        "group relative rounded-xl border p-3 transition-all",
        source.active ? "border-accent/30 bg-accent/5" : "border-border bg-secondary/30 opacity-55"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", source.active ? "bg-accent/10" : "bg-secondary")}>
          <cfg.icon className={cn("h-4 w-4", source.active ? cfg.color : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate text-foreground">{source.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[10px] font-medium", cfg.color)}>{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {source.charCount.toLocaleString("pt-BR")} chars
            </span>
          </div>
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-accent hover:underline mt-0.5 truncate"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              {source.sourceUrl.slice(0, 40)}…
            </a>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggle(source.id)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title={source.active ? "Desativar" : "Ativar"}>
            {source.active ? <Eye className="h-3.5 w-3.5 text-accent" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => onDelete(source.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Remover">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Add Source Modal ──────────────────────────────────────────
const AddSourceModal = ({
  onAdd,
  onClose,
}: {
  onAdd: (source: Omit<Source, "id" | "createdAt">) => Promise<void> | void;
  onClose: () => void;
}) => {
  type Tab = "text" | "pdf" | "url" | "search";
  const [tab, setTab] = useState<Tab>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [instantAnswer, setInstantAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await extractPdfText(file);
      setTitle(file.name.replace(/\.pdf$/i, ""));
      setContent(text);
      toast.success(`PDF extraído: ${text.length.toLocaleString()} caracteres`);
    } catch {
      toast.error("Erro ao extrair PDF. Tente colar o texto manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const data = await fetchUrlContent(urlInput.trim());
      setTitle(data.title || urlInput);
      setContent(data.text);
      toast.success(`Página importada: ${data.charCount.toLocaleString()} caracteres`);
    } catch (err) {
      // Fetch failed (site bloqueia scraping) — gera template editável a partir da URL
      let productName = "";
      let hostname = "";
      try {
        const parsed = new URL(urlInput.trim());
        hostname = parsed.hostname.replace("www.", "");
        // Extrai o nome do produto do caminho (antes do /p/ ou último segmento)
        const pathSegments = parsed.pathname.split("/").filter(Boolean);
        const productSegment = pathSegments.find(s => s.length > 10 && !s.startsWith("p")) || pathSegments[0] || "";
        productName = productSegment.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).slice(0, 120);
      } catch {
        hostname = urlInput.trim().slice(0, 40);
      }
      setTitle(productName || hostname);
      setContent(`Produto: ${productName || "—"}\nFonte: ${hostname}\nURL: ${urlInput.trim()}\n\nPreço unitário: R$ \nData da pesquisa: ${new Date().toLocaleDateString("pt-BR")}\nObservações: `);
      toast.warning("Site não permite extração automática. Preencha o preço e as informações abaixo antes de salvar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchResults([]);
    setInstantAnswer("");
    try {
      const data = await searchWeb(searchQuery.trim());
      setSearchResults(data.results || []);
      setInstantAnswer(data.instantAnswer || "");
      if (!data.results?.length && !data.instantAnswer) {
        toast.info("Nenhum resultado encontrado. Tente termos mais específicos.");
      }
    } catch (err) {
      toast.error(`Erro na busca: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const addSearchResult = async (result: SearchResult) => {
    setLoading(true);
    try {
      const data = await fetchUrlContent(result.url);
      await onAdd({
        title: result.title || result.source,
        content: data.text,
        type: "url",
        active: true,
        charCount: data.charCount,
        sourceUrl: result.url,
      });
      toast.success("Página importada como fonte!");
    } catch {
      await onAdd({
        title: result.title || result.source,
        content: `${result.snippet}\n\nFonte: ${result.url}`,
        type: "search",
        active: true,
        charCount: result.snippet.length,
        sourceUrl: result.url,
      });
      toast.success("Trecho adicionado como fonte");
    } finally {
      setLoading(false);
    }
  };

  const addInstantAnswer = async () => {
    if (!instantAnswer) return;
    await onAdd({
      title: `Busca: ${searchQuery}`,
      content: instantAnswer,
      type: "search",
      active: true,
      charCount: instantAnswer.length,
    });
    toast.success("Resposta imediata adicionada!");
  };

  const handleAddManual = async () => {
    const effectiveContent = content.trim() || (tab === "url" ? urlInput.trim() : "");
    if (!effectiveContent) return;
    await onAdd({
      title: title.trim() || (tab === "url" ? urlInput.trim().slice(0, 80) : "Documento sem título"),
      content: effectiveContent,
      type: tab === "pdf" ? "pdf" : tab === "url" ? "url" : "text",
      active: true,
      charCount: effectiveContent.length,
      sourceUrl: tab === "url" ? urlInput.trim() || undefined : undefined,
    });
    onClose();
  };

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "text", label: "Texto", icon: PenLine },
    { key: "pdf", label: "PDF", icon: FileText },
    { key: "url", label: "Importar URL", icon: Link2 },
    { key: "search", label: "Buscar na Web", icon: Search },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" /> Adicionar Fonte
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0 shrink-0 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.key
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted-foreground hover:bg-secondary border border-transparent"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TEXT tab */}
          {tab === "text" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Título</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Edital PE 023/2026, TR — Serviços de TI..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Conteúdo</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole aqui o texto do edital, termo de referência, ETP, contrato ou qualquer documento jurídico..."
                  rows={10}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} caracteres</p>
              </div>
            </>
          )}

          {/* PDF tab */}
          {tab === "pdf" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-secondary/30 hover:bg-accent/5 transition-all cursor-pointer p-8"
              >
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdf} />
                {loading ? <Loader2 className="h-8 w-8 text-accent animate-spin mb-2" /> : <Upload className="h-8 w-8 text-muted-foreground mb-2" />}
                <p className="text-sm font-medium">{loading ? "Extraindo texto…" : "Clique para selecionar um PDF"}</p>
                <p className="text-xs text-muted-foreground mt-1">Extração automática de até 50 páginas</p>
              </div>
              {content && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Título</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Texto extraído (editável)</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} caracteres</p>
                  </div>
                </>
              )}
            </>
          )}

          {/* URL tab */}
          {tab === "url" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  URL do site ou documento
                </label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                    placeholder="https://pncp.gov.br/... ou qualquer site"
                    className="flex-1"
                  />
                  <Button variant="gold" size="sm" onClick={handleFetchUrl} disabled={!urlInput.trim() || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                    Importar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Funciona com PNCP, ComprasNet, sites de fornecedores, tabelas de preços, portais públicos, etc.
                </p>
              </div>

              {content && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Título importado</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Conteúdo extraído</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} caracteres</p>
                  </div>
                </>
              )}
            </>
          )}

          {/* SEARCH tab */}
          {tab === "search" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Buscar preços, fornecedores, referências
                </label>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder='Ex: "preço notebook Dell 2025", "licitação manutenção predial SP"'
                    className="flex-1"
                  />
                  <Button variant="gold" size="sm" onClick={handleSearch} disabled={!searchQuery.trim() || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Pesquisa na web via DuckDuckGo. Clique em "Adicionar" nos resultados relevantes para incluí-los como fontes.
                </p>
              </div>

              {/* Instant answer */}
              {instantAnswer && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-accent mb-1">Resposta imediata</p>
                      <p className="text-sm text-foreground leading-relaxed">{instantAnswer}</p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={addInstantAnswer}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{searchResults.length} resultado{searchResults.length > 1 ? "s" : ""} encontrado{searchResults.length > 1 ? "s" : ""}</p>
                  {searchResults.map((result, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3 hover:border-accent/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{result.title}</p>
                          <p className="text-[11px] text-accent mb-1">{result.source}</p>
                          {result.snippet && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{result.snippet}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Abrir link">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => addSearchResult(result)} disabled={loading}>
                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && searchResults.length === 0 && !instantAnswer && searchQuery && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum resultado. Tente termos diferentes ou importe uma URL diretamente.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — show Add button for text/pdf/url tabs only */}
        {(tab === "text" || tab === "pdf" || tab === "url") && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="gold" size="sm" onClick={handleAddManual} disabled={tab === "url" ? !urlInput.trim() : !content.trim()}>
              <Plus className="h-4 w-4" /> Adicionar Fonte
            </Button>
          </div>
        )}
        {tab === "search" && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── Generator Output Card ─────────────────────────────────────
const OutputCard = ({
  output,
  onRegenerate,
  isRegenerating,
}: {
  output: GeneratedOutput;
  onRegenerate: (type: GeneratorType) => void;
  isRegenerating: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const gen = GENERATORS.find((g) => g.type === output.type)!;

  const handleCopy = () => {
    navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  const handleExport = () => {
    exportAsPdf({
      documentTitle: gen.label,
      legalBasis: "Lei 14.133/2021",
      sections: [{ title: gen.label, content: output.content }],
    });
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <gen.icon className={cn("h-4 w-4", gen.color)} />
          <span className="text-sm font-semibold">{gen.label}</span>
          {isRegenerating && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">{output.generatedAt}</span>
          <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Copiar">
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Exportar PDF">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onRegenerate(output.type)} disabled={isRegenerating} className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40" title="Regenerar">
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="px-4 py-4 max-h-96 overflow-y-auto">
        <div className="prose prose-sm max-w-none text-foreground [&>p]:leading-relaxed [&>ul]:space-y-1 [&>ol]:space-y-1">
          <ReactMarkdown>{output.content}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
};

// ── Studio Panel ──────────────────────────────────────────────
const StudioPanel = ({
  sources,
  outputs,
  generating,
  onGenerate,
}: {
  sources: Source[];
  outputs: GeneratedOutput[];
  generating: GeneratorType | null;
  onGenerate: (type: GeneratorType) => void;
}) => {
  const activeCount = sources.filter((s) => s.active).length;
  const [view, setView] = useState<"buttons" | "outputs">("buttons");

  useEffect(() => {
    if (outputs.length > 0) setView("outputs");
  }, [outputs.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Estúdio de Análise</span>
        </div>
        <div className="flex gap-1">
          {(["buttons", "outputs"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors relative",
                view === v ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {v === "buttons" ? "Gerar" : "Resultados"}
              {v === "outputs" && outputs.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-white text-[9px] font-bold">
                  {outputs.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "buttons" ? (
            <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-2">
              {activeCount === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center mb-3">
                  <p className="text-xs text-muted-foreground">Adicione e ative fontes para gerar análises</p>
                </div>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                Análises exclusivas do Notebook
              </p>
              {GENERATORS.map((gen) => {
                const isGen = generating === gen.type;
                const done = outputs.find((o) => o.type === gen.type);
                return (
                  <button
                    key={gen.type}
                    onClick={() => onGenerate(gen.type)}
                    disabled={activeCount === 0 || !!generating}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border group",
                      isGen ? "border-accent/40 bg-accent/5" : done ? "border-accent/20 hover:border-accent/30" : "border-border hover:border-accent/20 hover:bg-secondary/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors", isGen ? "bg-accent/20" : "bg-secondary group-hover:bg-accent/10")}>
                      {isGen ? <Loader2 className="h-4 w-4 text-accent animate-spin" /> : <gen.icon className={cn("h-4 w-4", gen.color)} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{gen.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{gen.description}</p>
                    </div>
                    {done && !isGen ? (
                      <CheckCheck className="h-4 w-4 text-accent shrink-0" />
                    ) : !isGen ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : null}
                  </button>
                );
              })}

              {/* Shortcut links to pages with overlapping tools */}
              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                  Ferramentas dedicadas
                </p>
                {[
                  { label: "Checklist de Conformidade", path: "/dashboard/checklist", desc: "Checklist interativo por tipo de contratação" },
                  { label: "Diagnóstico de Modalidade", path: "/dashboard/diagnostic", desc: "Formulário guiado para identificar a modalidade" },
                  { label: "Validador de Editais", path: "/dashboard/validator", desc: "Análise automática de PDFs de editais" },
                ].map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-border hover:border-accent/20 hover:bg-secondary/50 transition-all group"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{link.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="outputs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              {outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="h-10 w-10 text-accent/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda</p>
                  <button onClick={() => setView("buttons")} className="mt-3 text-xs text-accent hover:underline">
                    Ir para Gerar →
                  </button>
                </div>
              ) : (
                [...outputs].reverse().map((output) => (
                  <OutputCard key={output.type} output={output} onRegenerate={onGenerate} isRegenerating={generating === output.type} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Chat Panel ────────────────────────────────────────────────
const ChatPanel = ({ sources }: { sources: Source[] }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Olá! Sou seu assistente jurídico no modo Notebook.\n\nCarregue documentos, importe URLs ou faça buscas na web para adicionar fontes — e me faça perguntas sobre elas.\n\nPosso ajudar com:\n- **Interpretação** de cláusulas e artigos\n- **Análise de preços** e referências de mercado\n- **Dúvidas** sobre a Lei 14.133/2021\n- **Comparação** entre documentos",
      timestamp: nowStr(),
    },
  ]);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, timestamp: nowStr() };
    const newHistory = [...history, { role: "user" as const, content: text }];

    setMessages((prev) => [...prev, userMsg]);
    setHistory(newHistory);
    setInput("");
    setIsTyping(true);

    const aiId = uid();
    let accumulated = "";
    const systemPrompt = buildSystemPrompt(sources);
    const chatMessages = systemPrompt
      ? [
          { role: "user" as const, content: `[CONTEXTO DO NOTEBOOK]\n${systemPrompt}` },
          { role: "assistant" as const, content: "Entendido. Li todos os documentos/fontes e estou pronto." },
          ...newHistory,
        ]
      : newHistory;

    streamChat({
      messages: chatMessages,
      usuarioId: userEmail,
      onDelta: (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== aiId);
          return [...without, { id: aiId, role: "assistant", content: accumulated, timestamp: nowStr() }];
        });
      },
      onDone: () => {
        setIsTyping(false);
        setHistory((prev) => [...prev, { role: "assistant", content: accumulated }]);
      },
      onError: (err) => {
        toast.error(err);
        setIsTyping(false);
      },
    });
  };

  const copyMsg = (content: string) => { navigator.clipboard.writeText(content); toast.success("Copiado!"); };
  const clearChat = () => {
    setMessages([{ id: uid(), role: "assistant", content: "Conversa reiniciada. Como posso ajudar?", timestamp: nowStr() }]);
    setHistory([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Chat Jurídico</span>
          {sources.filter((s) => s.active).length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {sources.filter((s) => s.active).length} fonte{sources.filter((s) => s.active).length > 1 ? "s" : ""} ativa{sources.filter((s) => s.active).length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-0.5">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div className={cn("max-w-[78%] space-y-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed", msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md")}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                <div className={cn("flex items-center gap-1", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.role === "assistant" && (
                    <button onClick={() => copyMsg(msg.content)} className="p-1 rounded hover:bg-secondary transition-colors">
                      <Copy className="h-3 w-3 text-muted-foreground/60" />
                    </button>
                  )}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary mt-0.5">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="rounded-2xl bg-secondary px-4 py-3 rounded-bl-md">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button key={action} onClick={() => sendMessage(action)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/30 hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all">
              {action}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-4 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/40 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Pergunte sobre os documentos ou dados de preço… (Enter para enviar)"
            disabled={isTyping}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1"
            style={{ maxHeight: 120 }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
          />
          <Button variant="gold" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}>
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
export default function NotebookPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [generating, setGenerating] = useState<GeneratorType | null>(null);
  const [notebookTitle, setNotebookTitle] = useState("Notebook Jurídico");
  const [editingTitle, setEditingTitle] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: rows, error } = await supabase
        .from("notebook_sources")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && rows) {
        if (rows.length === 0) {
          try {
            const local: Source[] = JSON.parse(localStorage.getItem(SOURCES_KEY) ?? "[]");
            if (local.length > 0) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: migrated } = await supabase
                  .from("notebook_sources")
                  .insert(local.map((s) => ({
                    user_id: user.id,
                    title: s.title,
                    content: s.content,
                    type: s.type,
                    active: s.active,
                    char_count: s.charCount,
                    source_url: s.sourceUrl || null,
                    created_at: s.createdAt,
                  })))
                  .select();
                if (migrated) {
                  setSources(migrated.map(mapSource));
                  localStorage.removeItem(SOURCES_KEY);
                  toast.success(`${migrated.length} fonte(s) migradas para a nuvem`);
                }
              }
            }
          } catch { /* ignore */ }
        } else {
          setSources(rows.map(mapSource));
        }
      }
      setLoadingSources(false);
    };
    load();
  }, []);

  const addSource = async (data: Omit<Source, "id" | "createdAt">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para salvar fontes"); return; }
    const { data: row, error } = await supabase
      .from("notebook_sources")
      .insert({ user_id: user.id, title: data.title, content: data.content, type: data.type, active: data.active, char_count: data.charCount, source_url: data.sourceUrl || null })
      .select()
      .single();
    if (error || !row) { toast.error(`Erro ao salvar fonte: ${error?.message ?? "resposta vazia do banco"}`); return; }
    setSources((prev) => [...prev, mapSource(row)]);
  };

  const toggleSource = async (id: string) => {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    const { error } = await supabase.from("notebook_sources").update({ active: !src.active }).eq("id", id);
    if (!error) setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  };

  const deleteSource = async (id: string) => {
    const { error } = await supabase.from("notebook_sources").delete().eq("id", id);
    if (!error) { setSources((prev) => prev.filter((s) => s.id !== id)); toast.success("Fonte removida"); }
    else toast.error("Erro ao remover fonte");
  };

  const setAllActive = async (active: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("notebook_sources").update({ active }).eq("user_id", user.id);
    if (!error) setSources((prev) => prev.map((s) => ({ ...s, active })));
  };

  const generateAnalysis = useCallback(
    async (type: GeneratorType) => {
      const activeSources = sources.filter((s) => s.active);
      if (!activeSources.length) { toast.error("Ative pelo menos uma fonte"); return; }

      const gen = GENERATORS.find((g) => g.type === type)!;
      setGenerating(type);

      const systemPrompt = buildSystemPrompt(sources);
      const chatMessages = systemPrompt
        ? [
            { role: "user" as const, content: `[CONTEXTO DO NOTEBOOK]\n${systemPrompt}` },
            { role: "assistant" as const, content: "Entendido. Li todos os documentos e estou pronto." },
            { role: "user" as const, content: gen.prompt },
          ]
        : [{ role: "user" as const, content: gen.prompt }];

      let accumulated = "";
      const generatedAt = nowStr();

      streamChat({
        messages: chatMessages,
        usuarioId: userEmail,
        onDelta: (chunk) => {
          accumulated += chunk;
          setOutputs((prev) => {
            const filtered = prev.filter((o) => o.type !== type);
            return [...filtered, { type, content: accumulated, generatedAt }];
          });
        },
        onDone: () => { setGenerating(null); toast.success(`${gen.label} gerado!`); },
        onError: (err) => { toast.error(`Erro: ${err}`); setGenerating(null); },
      });
    },
    [sources, userEmail]
  );

  const activeCount = sources.filter((s) => s.active).length;
  const totalChars = sources.filter((s) => s.active).reduce((a, s) => a + s.charCount, 0);

  const sourceTypeCounts = sources.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <BookMarked className="h-5 w-5 text-accent" />
          </div>
          <div>
            {editingTitle ? (
              <input
                autoFocus
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                className="text-xl font-bold bg-transparent border-b-2 border-accent focus:outline-none pb-0.5 text-foreground"
                style={{ width: Math.max(200, notebookTitle.length * 12) + "px" }}
              />
            ) : (
              <button onClick={() => setEditingTitle(true)} className="flex items-center gap-2 group text-left">
                <h1 className="text-xl font-bold text-foreground">{notebookTitle}</h1>
                <PenLine className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {activeCount} de {sources.length} fonte{sources.length !== 1 ? "s" : ""} ativa{activeCount !== 1 ? "s" : ""}
              </span>
              {Object.entries(sourceTypeCounts).map(([type, count]) => {
                const cfg = SOURCE_TYPE_CONFIG[type as keyof typeof SOURCE_TYPE_CONFIG];
                return (
                  <span key={type} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary", cfg.color)}>
                    {count} {cfg.label}
                  </span>
                );
              })}
              {totalChars > 0 && (
                <span className="text-[10px] text-muted-foreground">· {(totalChars / 1000).toFixed(1)}k chars em contexto</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 border border-accent/10 text-xs text-accent font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            IA Jurídica · Lei 14.133/2021
          </div>
        </div>
      </div>

      {/* Mobile/tablet toolbar to access side panels */}
      <div className="lg:hidden flex gap-2 mb-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Layers className="h-4 w-4 mr-1.5" /> Fontes ({sources.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[88vw] sm:w-[380px]">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold">Fontes</span>
                  {sources.length > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{sources.length}</span>
                  )}
                </div>
                <Button variant="gold" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-dashed border-border mb-3">
                      <FileText className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma fonte</p>
                    <p className="text-xs text-muted-foreground/60 leading-relaxed mb-3">
                      Adicione editais, TRs, ETPs, importe URLs ou busque dados de preços na web
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                      <Plus className="h-3.5 w-3.5" /> Adicionar fonte
                    </Button>
                  </div>
                ) : (
                  sources.map((s) => (
                    <SourceCard key={s.id} source={s} onToggle={toggleSource} onDelete={deleteSource} />
                  ))
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 xl:hidden">
              <Sparkles className="h-4 w-4 mr-1.5" /> Studio
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-[88vw] sm:w-[380px]">
            <StudioPanel sources={sources} outputs={outputs} generating={generating} onGenerate={generateAnalysis} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Left: Sources (desktop only) */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">Fontes</span>
              {sources.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{sources.length}</span>
              )}
            </div>
            <Button variant="gold" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAddModal(true)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {loadingSources ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                </motion.div>
              ) : sources.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-dashed border-border mb-3">
                    <FileText className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma fonte</p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed mb-3">
                    Adicione editais, TRs, ETPs, importe URLs ou busque dados de preços na web
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                    <Plus className="h-3.5 w-3.5" /> Adicionar fonte
                  </Button>
                </motion.div>
              ) : (
                sources.map((s) => (
                  <SourceCard key={s.id} source={s} onToggle={toggleSource} onDelete={deleteSource} />
                ))
              )}
            </AnimatePresence>
          </div>

          {sources.length > 0 && (
            <div className="border-t border-border px-4 py-3 flex justify-between shrink-0">
              <button onClick={() => setAllActive(true)} className="text-[11px] text-muted-foreground hover:text-accent transition-colors font-medium">
                Ativar todas
              </button>
              <button onClick={() => setAllActive(false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Desativar todas
              </button>
            </div>
          )}
        </div>

        {/* Center: Chat */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0">
          <ChatPanel sources={sources} />
        </div>

        {/* Right: Studio (xl only) */}
        <div className="hidden xl:flex w-80 shrink-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
          <StudioPanel sources={sources} outputs={outputs} generating={generating} onGenerate={generateAnalysis} />
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && <AddSourceModal onAdd={addSource} onClose={() => setShowAddModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
