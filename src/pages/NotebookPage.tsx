import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  BookOpen, Plus, Trash2, FileText, Send, Bot, User, Copy, RotateCcw,
  Sparkles, X, Eye, EyeOff, Wand2, AlertTriangle, Calendar,
  Loader2, CheckCheck, Upload, PenLine, Newspaper, Download,
  ChevronRight, MessageSquare, BookMarked, Search, Layers, Globe,
  Link2, ExternalLink, HelpCircle, Headphones, Play, Pause,
  SkipForward, SkipBack, ChevronLeft, Clock, ListChecks, Briefcase,
  ArrowLeft, MoreVertical, Volume2, BookCopy, RefreshCw, Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/streamChat";
import { extractPdfText } from "@/lib/pdfExtract";
import { exportAsPdf } from "@/lib/exportDocument";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────
interface Notebook {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceCount?: number;
}

type EmbedStatus = "pending" | "processing" | "done" | "error";

interface Source {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  type: "text" | "pdf" | "url" | "search";
  active: boolean;
  charCount: number;
  sourceUrl?: string;
  createdAt: string;
  embedStatus: EmbedStatus;
  chunkCount: number;
  embedError?: string;
}

interface RetrievedChunk {
  id: string;
  source_id: string;
  content: string;
  chunk_index: number;
  char_start: number;
  char_end: number;
  similarity: number;
}

// Trecho de uma fonte efetivamente enviado ao modelo (para citação clicável)
interface CitationExcerpt { start: number; end: number; text: string }

interface Citation {
  index: number;      // número usado no texto: [Fonte N]
  sourceId: string;
  title: string;
  excerpts: CitationExcerpt[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  persisted?: boolean;
  citations?: Citation[];
}

type GeneratorType = "summary" | "prazos" | "riscos" | "perguntas" | "faq" | "timeline" | "briefing";

interface GeneratedOutput {
  type: GeneratorType;
  content: string;
  generatedAt: string;
}

interface AudioSegment {
  speaker: "A" | "B";
  text: string;
  path: string;
  url?: string;
}

interface AudioOverview {
  id: string;
  segments: AudioSegment[];
  script: string;
  generatedAt: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// ── Constants ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const nowStr = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const timeOf = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const AUDIO_BUCKET = "notebook-audio";
const RAG_CHAT_CHUNKS = 8;        // trechos por pergunta no chat
const RAG_STUDIO_CHUNKS = 30;     // trechos por análise do Estúdio (precisa de cobertura)
const FALLBACK_CHARS_PER_SOURCE = 8000; // fonte ainda não indexada: texto integral, limitado
const HISTORY_WINDOW = 20;        // últimas mensagens reenviadas ao modelo

const mapNotebook = (row: any): Notebook => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sourceCount: row.source_count,
});

const mapSource = (row: any): Source => ({
  id: row.id,
  notebookId: row.notebook_id,
  title: row.title,
  content: row.content,
  type: row.type as Source["type"],
  active: row.active,
  charCount: row.char_count,
  sourceUrl: row.source_url ?? undefined,
  createdAt: row.created_at,
  embedStatus: (row.embed_status as EmbedStatus) || (row.is_embedded ? "done" : "pending"),
  chunkCount: row.chunk_count ?? 0,
  embedError: row.embed_error ?? undefined,
});

const SOURCE_TYPE_CONFIG = {
  text:   { icon: PenLine,   label: "Texto",  color: "text-blue-500"   },
  pdf:    { icon: FileText,  label: "PDF",    color: "text-red-500"    },
  url:    { icon: Link2,     label: "URL",    color: "text-green-500"  },
  search: { icon: Search,    label: "Busca",  color: "text-purple-500" },
};

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
    prompt: "Com base nos documentos fornecidos, redija um **Resumo Jurídico Executivo** completo cobrindo: (1) objeto da contratação, (2) valor estimado, (3) modalidade aplicável, (4) requisitos essenciais e (5) principais obrigações das partes. Use markdown com títulos e bullets. Cite artigos da Lei 14.133/2021 quando pertinente.",
  },
  {
    type: "prazos",
    label: "Mapa de Prazos",
    description: "Todos os prazos e obrigações em tabela",
    icon: Calendar,
    color: "text-amber-600",
    prompt: "Extraia e organize em tabela markdown **todos os prazos, datas-limite e obrigações temporais** presentes nos documentos. Colunas: | Prazo/Data | Descrição | Responsável | Base Legal |. Inclua prazos recursais, de habilitação, de entrega, de pagamento e qualquer outro prazo relevante. Se não houver data explícita, informe o prazo legal aplicável conforme Lei 14.133/2021.",
  },
  {
    type: "riscos",
    label: "Análise de Riscos",
    description: "Riscos jurídicos com nível de criticidade",
    icon: AlertTriangle,
    color: "text-red-600",
    prompt: "Realize uma **Análise de Riscos Jurídicos** dos documentos. Para cada risco: Descrição, Probabilidade (Alta/Média/Baixa), Impacto (Alto/Médio/Baixo), Base legal e Recomendação de mitigação. Organize do mais crítico ao menos crítico. Destaque cláusulas potencialmente nulas ou ilegais.",
  },
  {
    type: "perguntas",
    label: "Pedido de Esclarecimentos",
    description: "Perguntas técnicas para o órgão licitante",
    icon: HelpCircle,
    color: "text-purple-600",
    prompt: "Elabore um **Pedido de Esclarecimentos** completo para envio ao órgão licitante. Liste pontos ambíguos, contraditórios ou restritivos à competitividade. Formule cada pergunta de forma técnica, numeradas e referenciando o item/cláusula do documento. Inclua sugestão de como o órgão deveria responder.",
  },
  {
    type: "faq",
    label: "Perguntas Frequentes",
    description: "FAQ com as dúvidas mais comuns sobre os documentos",
    icon: ListChecks,
    color: "text-teal-600",
    prompt: "Com base nos documentos, crie um **FAQ (Perguntas Frequentes)** com as 10-15 perguntas mais prováveis de licitantes e profissionais sobre este processo. Para cada pergunta, forneça uma resposta clara e objetiva, citando artigos da Lei 14.133/2021 quando pertinente. Formate como: **P:** pergunta / **R:** resposta.",
  },
  {
    type: "timeline",
    label: "Linha do Tempo",
    description: "Cronograma visual de etapas e marcos",
    icon: Clock,
    color: "text-orange-600",
    prompt: "Construa uma **Linha do Tempo detalhada** do processo licitatório extraindo todas as etapas, marcos, prazos e eventos dos documentos. Organize em ordem cronológica. Para cada evento: Data/Prazo, Evento, Descrição, Responsável e Base Legal. Não use emojis. Destaque marcos críticos.",
  },
  {
    type: "briefing",
    label: "Briefing Executivo",
    description: "Resumo executivo para tomada de decisão",
    icon: Briefcase,
    color: "text-indigo-600",
    prompt: "Elabore um **Briefing Executivo** conciso (máximo 1 página) para apoiar a tomada de decisão da liderança sobre este processo. Inclua: Síntese em 3 linhas, Oportunidade/Risco principal, Valor e prazo, Ação recomendada, Próximos passos. Seja direto e objetivo, como se apresentasse para um CEO.",
  },
];

const QUICK_ACTIONS = [
  "Qual a modalidade correta para este objeto?",
  "Liste todos os prazos recursais",
  "Há cláusulas restritivas à competitividade?",
  "Quais documentos de habilitação são exigidos?",
  "Qual o valor estimado desta contratação?",
  "Esta dispensa tem fundamentação adequada?",
];

// ── Contexto para o modelo (RAG) ──────────────────────────────
// Fontes indexadas entram só com os trechos recuperados pela busca semântica;
// fontes ainda não indexadas entram com o texto integral, limitado. Em ambos
// os casos a numeração [Fonte N] segue a ordem das fontes ativas, e devolvemos
// a lista de citações (fonte + trechos) para tornar as referências clicáveis.
const buildContext = (active: Source[], chunks: RetrievedChunk[]) => {
  if (!active.length) return null;

  const bySource = new Map<string, RetrievedChunk[]>();
  for (const c of chunks) {
    if (!bySource.has(c.source_id)) bySource.set(c.source_id, []);
    bySource.get(c.source_id)!.push(c);
  }

  const citations: Citation[] = [];
  const blocks: string[] = [];
  const silent: string[] = [];

  active.forEach((s, i) => {
    const n = i + 1;
    const header = `### [Fonte ${n}] ${s.title} (${SOURCE_TYPE_CONFIG[s.type].label}${s.sourceUrl ? ` · ${s.sourceUrl}` : ""})`;
    const own = (bySource.get(s.id) || []).sort((a, b) => a.chunk_index - b.chunk_index);

    if (own.length) {
      const body = own.map((c, k) => `[Trecho ${n}.${k + 1} — caracteres ${c.char_start}–${c.char_end}]\n${c.content}`).join("\n\n");
      blocks.push(`${header}\n\n${body}`);
      citations.push({ index: n, sourceId: s.id, title: s.title, excerpts: own.map((c) => ({ start: c.char_start, end: c.char_end, text: c.content })) });
    } else if (s.embedStatus !== "done") {
      const truncated = s.content.length > FALLBACK_CHARS_PER_SOURCE;
      const text = truncated ? s.content.slice(0, FALLBACK_CHARS_PER_SOURCE) + "\n[… conteúdo truncado; a fonte ainda está sendo indexada]" : s.content;
      blocks.push(`${header}\n\n${text}`);
      citations.push({ index: n, sourceId: s.id, title: s.title, excerpts: [] });
    } else {
      silent.push(`[Fonte ${n}] ${s.title}`);
    }
  });

  const prompt = `Você é um assistente jurídico especializado em licitações públicas e na Lei 14.133/2021. Responda sempre em português do Brasil.

O usuário carregou fontes para análise. Abaixo estão os trechos mais relevantes para a pergunta atual:

${blocks.join("\n\n---\n\n") || "(nenhum trecho relevante foi encontrado nas fontes)"}
${silent.length ? `\n\nOutras fontes ativas sem trechos relevantes para esta pergunta: ${silent.join("; ")}` : ""}

---

Instruções:
- Baseie-se APENAS nos trechos acima para afirmações sobre os documentos; se a informação não estiver neles, diga isso claramente
- Cite as fontes pelo número exatamente no formato [Fonte 1], [Fonte 2] etc., sempre que usar informação de um trecho
- Nunca cite um número de fonte que não aparece acima
- Cite artigos da Lei 14.133/2021 quando pertinente
- Use markdown para formatar respostas longas
- Seja preciso e fundamentado`;

  return { prompt, citations };
};

// Transforma "[Fonte 2]" em link interno para o renderizador de markdown
const linkifyCitations = (text: string) => text.replace(/\[Fonte (\d+)\]/g, "[Fonte $1](#cite-$1)");

// ── API helpers ───────────────────────────────────────────────
const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Você precisa estar logado.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
};

const callFn = async <T,>(name: string, body: unknown): Promise<T> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
};

const fetchUrlContent = (url: string) =>
  callFn<{ title: string; text: string; charCount: number }>("notebook-fetch", { url });

const searchWeb = (query: string) =>
  callFn<{ results: SearchResult[]; instantAnswer: string }>("notebook-search", { query });

const searchChunks = async (query: string, sourceIds: string[], matchCount: number): Promise<RetrievedChunk[]> => {
  if (!sourceIds.length) return [];
  const { chunks } = await callFn<{ chunks: RetrievedChunk[] }>("search-chunks", { query, sourceIds, matchCount });
  return chunks || [];
};

const embedSourceRemote = (sourceId: string) =>
  callFn<{ chunks_count: number }>("embed-source", { sourceId });

const signAudio = async (segments: AudioSegment[]): Promise<AudioSegment[]> => {
  const paths = segments.map((s) => s.path);
  const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrls(paths, 60 * 60);
  const byPath = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  return segments.map((s) => ({ ...s, url: byPath.get(s.path) || undefined }));
};

// ── Audio Player Hook ─────────────────────────────────────────
function useAudioPlayer(segments: AudioSegment[]) {
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const loadedIdx = useRef<number | null>(null);

  const playSegment = useCallback((idx: number) => {
    if (idx < 0 || idx >= segments.length) { setIsPlaying(false); return; }
    const seg = segments[idx];
    if (!seg.url) { toast.error("Áudio indisponível — gere novamente."); return; }
    setCurrentIdx(idx);
    setIsLoading(true);

    audioRef.current?.pause();
    const audio = new Audio(seg.url);
    audioRef.current = audio;
    loadedIdx.current = idx;
    audio.oncanplaythrough = () => setIsLoading(false);
    audio.onended = () => playSegment(idx + 1);
    audio.onerror = () => { setIsLoading(false); setIsPlaying(false); };
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [segments]);

  // Retoma de onde parou se o segmento atual já está carregado
  const play = () => {
    if (isPlaying) return;
    const a = audioRef.current;
    if (a && loadedIdx.current === currentIdx && a.paused && !a.ended) {
      a.play().then(() => setIsPlaying(true)).catch(() => playSegment(currentIdx));
    } else playSegment(currentIdx);
  };
  const pause = () => { audioRef.current?.pause(); setIsPlaying(false); };
  const prev  = () => playSegment(Math.max(0, currentIdx - 1));
  const next  = () => playSegment(Math.min(segments.length - 1, currentIdx + 1));
  const seek  = (idx: number) => playSegment(idx);

  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  return { currentIdx, isPlaying, isLoading, play, pause, prev, next, seek };
}

// ── Source Card ───────────────────────────────────────────────
const EMBED_LABEL: Record<EmbedStatus, string> = {
  pending: "Aguardando indexação", processing: "Indexando…", done: "Indexada", error: "Falha na indexação",
};

const SourceCard = ({
  source, onToggle, onDelete, onView, onReindex,
}: {
  source: Source;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (source: Source) => void;
  onReindex: (id: string) => void;
}) => {
  const cfg = SOURCE_TYPE_CONFIG[source.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
      className={cn(
        "group relative rounded-xl border p-3 transition-all cursor-pointer",
        source.active ? "border-accent/30 bg-accent/5" : "border-border bg-secondary/30 opacity-55"
      )}
      onClick={() => onView(source)}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", source.active ? "bg-accent/10" : "bg-secondary")}>
          <cfg.icon className={cn("h-4 w-4", source.active ? cfg.color : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate text-foreground">{source.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("text-[10px] font-medium", cfg.color)}>{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{source.charCount.toLocaleString("pt-BR")} chars</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span
              title={source.embedError || EMBED_LABEL[source.embedStatus]}
              className={cn("inline-flex items-center gap-1 text-[10px] font-medium",
                source.embedStatus === "done" ? "text-success" : source.embedStatus === "error" ? "text-destructive" : "text-muted-foreground")}>
              {source.embedStatus === "processing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {source.embedStatus === "done" && <CheckCheck className="h-2.5 w-2.5" />}
              {source.embedStatus === "error" && <AlertTriangle className="h-2.5 w-2.5" />}
              {source.embedStatus === "done" ? `${source.chunkCount} trecho${source.chunkCount === 1 ? "" : "s"}` : EMBED_LABEL[source.embedStatus]}
            </span>
          </div>
          {source.sourceUrl && (
            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] text-accent hover:underline mt-0.5 truncate">
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              {source.sourceUrl.slice(0, 40)}…
            </a>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {(source.embedStatus === "error" || source.embedStatus === "pending") && (
            <button onClick={() => onReindex(source.id)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Indexar fonte">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
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

// ── Source Viewer Sheet ───────────────────────────────────────
// Recebe os trechos citados e os destaca no texto, rolando até o primeiro.
const mergeRanges = (ranges: CitationExcerpt[], max: number) => {
  const sorted = ranges
    .map((r) => ({ start: Math.max(0, r.start), end: Math.min(max, r.end) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
};

const SourceViewer = ({
  source, highlights, onClose,
}: {
  source: Source | null;
  highlights: CitationExcerpt[];
  onClose: () => void;
}) => {
  const firstMark = useRef<HTMLElement | null>(null);
  const ranges = useMemo(() => source ? mergeRanges(highlights, source.content.length) : [], [source, highlights]);

  useEffect(() => {
    if (!source || !ranges.length) return;
    const t = setTimeout(() => firstMark.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [source, ranges]);

  const pieces: React.ReactNode[] = [];
  if (source) {
    let cursor = 0;
    ranges.forEach((r, i) => {
      if (r.start > cursor) pieces.push(<span key={`t${i}`}>{source.content.slice(cursor, r.start)}</span>);
      pieces.push(
        <mark key={`m${i}`} ref={i === 0 ? (el) => { firstMark.current = el; } : undefined}
          className="bg-accent/25 text-foreground rounded-sm px-0.5 ring-1 ring-accent/40">
          {source.content.slice(r.start, r.end)}
        </mark>
      );
      cursor = r.end;
    });
    if (cursor < source.content.length) pieces.push(<span key="tail">{source.content.slice(cursor)}</span>);
  }

  return (
    <Sheet open={!!source} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="p-0 w-[90vw] sm:w-[520px] flex flex-col">
        {source && (
          <>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-secondary")}>
                {(() => { const C = SOURCE_TYPE_CONFIG[source.type].icon; return <C className={cn("h-5 w-5", SOURCE_TYPE_CONFIG[source.type].color)} />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{source.title}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {source.charCount.toLocaleString("pt-BR")} caracteres · {SOURCE_TYPE_CONFIG[source.type].label}
                  {ranges.length > 0 && <> · <span className="text-accent font-medium">{ranges.length} trecho{ranges.length > 1 ? "s" : ""} citado{ranges.length > 1 ? "s" : ""}</span></>}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {source.sourceUrl && (
              <div className="px-5 py-2 border-b border-border shrink-0">
                <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> {source.sourceUrl}
                </a>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{pieces}</pre>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ── Add Source Modal ──────────────────────────────────────────
type NewSource = Omit<Source, "id" | "notebookId" | "createdAt" | "embedStatus" | "chunkCount" | "embedError">;

const AddSourceModal = ({
  onAdd, onClose,
}: {
  onAdd: (source: NewSource) => Promise<void> | void;
  onClose: () => void;
}) => {
  type Tab = "text" | "pdf" | "url" | "search";
  const [tab, setTab]                     = useState<Tab>("text");
  const [title, setTitle]                 = useState("");
  const [content, setContent]             = useState("");
  const [urlInput, setUrlInput]           = useState("");
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [instantAnswer, setInstantAnswer] = useState("");
  const [loading, setLoading]             = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) { toast.error("Este PDF não tem texto extraível (provavelmente é digitalizado). Cole o texto manualmente."); return; }
      setTitle(file.name.replace(/\.pdf$/i, ""));
      setContent(text);
      toast.success(`PDF extraído: ${text.length.toLocaleString()} caracteres`);
    } catch { toast.error("Erro ao extrair PDF. Tente colar o texto manualmente."); }
    finally { setLoading(false); }
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
      let hostname = "", productName = "";
      try {
        const parsed = new URL(urlInput.trim());
        hostname = parsed.hostname.replace("www.", "");
        const seg = parsed.pathname.split("/").filter(Boolean).find(s => s.length > 10 && !s.startsWith("p")) || parsed.pathname.split("/").filter(Boolean)[0] || "";
        productName = seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).slice(0, 120);
      } catch { hostname = urlInput.trim().slice(0, 40); }
      setTitle(productName || hostname);
      setContent(`Produto: ${productName || "—"}\nFonte: ${hostname}\nURL: ${urlInput.trim()}\n\nPreço unitário: R$ \nData da pesquisa: ${new Date().toLocaleDateString("pt-BR")}\nObservações: `);
      toast.warning(`Não foi possível importar a página (${err instanceof Error ? err.message : "erro"}). Preencha as informações antes de salvar.`);
    } finally { setLoading(false); }
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
      if (!data.results?.length && !data.instantAnswer) toast.info("Nenhum resultado. Tente termos mais específicos.");
    } catch (err) { toast.error(`Erro na busca: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setLoading(false); }
  };

  const addSearchResult = async (result: SearchResult) => {
    setLoading(true);
    try {
      const data = await fetchUrlContent(result.url);
      await onAdd({ title: result.title || result.source, content: data.text, type: "url", active: true, charCount: data.charCount, sourceUrl: result.url });
      toast.success("Página importada como fonte!");
    } catch {
      await onAdd({ title: result.title || result.source, content: `${result.snippet}\n\nFonte: ${result.url}`, type: "search", active: true, charCount: result.snippet.length, sourceUrl: result.url });
      toast.success("Trecho adicionado como fonte");
    } finally { setLoading(false); }
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
    { key: "text", label: "Texto",       icon: PenLine   },
    { key: "pdf",  label: "PDF",         icon: FileText  },
    { key: "url",  label: "Importar URL",icon: Link2     },
    { key: "search",label:"Buscar na Web",icon: Search   },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" /> Adicionar Fonte
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 px-5 pt-4 pb-0 shrink-0 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.key ? "bg-accent/10 text-accent border border-accent/20" : "text-muted-foreground hover:bg-secondary border border-transparent")}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "text" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Título</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Edital PE 023/2026, TR — Serviços de TI..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Conteúdo</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole aqui o texto do edital, TR, ETP, contrato ou qualquer documento..."
                  rows={10} className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all resize-none" />
                <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} caracteres</p>
              </div>
            </>
          )}

          {tab === "pdf" && (
            <>
              <div onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-secondary/30 hover:bg-accent/5 transition-all cursor-pointer p-8">
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
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-none" />
                    <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} caracteres</p>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "url" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">URL do site ou documento</label>
                <div className="flex gap-2">
                  <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                    placeholder="https://pncp.gov.br/... ou qualquer site" className="flex-1" />
                  <Button variant="gold" size="sm" onClick={handleFetchUrl} disabled={!urlInput.trim() || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Importar
                  </Button>
                </div>
              </div>
              {content && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Título importado</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Conteúdo extraído</label>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
                      className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-none" />
                    <p className="text-[10px] text-muted-foreground mt-1">{content.length.toLocaleString("pt-BR")} charteres</p>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "search" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Buscar preços, fornecedores, referências</label>
                <div className="flex gap-2">
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder='"preço notebook Dell 2025", "licitação manutenção predial SP"' className="flex-1" />
                  <Button variant="gold" size="sm" onClick={handleSearch} disabled={!searchQuery.trim() || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                  </Button>
                </div>
              </div>
              {instantAnswer && (
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-accent mb-1">Resposta imediata</p>
                      <p className="text-sm text-foreground leading-relaxed">{instantAnswer}</p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={async () => { await onAdd({ title: `Busca: ${searchQuery}`, content: instantAnswer, type: "search", active: true, charCount: instantAnswer.length }); toast.success("Adicionado!"); }}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{searchResults.length} resultado{searchResults.length > 1 ? "s" : ""}</p>
                  {searchResults.map((result, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3 hover:border-accent/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{result.title}</p>
                          <p className="text-[11px] text-accent mb-1">{result.source}</p>
                          {result.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-secondary transition-colors"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => addSearchResult(result)} disabled={loading}>
                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {(tab === "text" || tab === "pdf" || tab === "url") && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="gold" size="sm" onClick={handleAddManual} disabled={tab === "url" ? !urlInput.trim() : !content.trim()}>
              <Plus className="h-4 w-4" /> Adicionar Fonte
            </Button>
          </div>
        )}
        {tab === "search" && (
          <div className="flex justify-end px-5 py-4 border-t border-border shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ── Generator Output Card ─────────────────────────────────────
const OutputCard = ({
  output, onRegenerate, onDelete, isRegenerating,
}: {
  output: GeneratedOutput;
  onRegenerate: (type: GeneratorType) => void;
  onDelete: (type: GeneratorType) => void;
  isRegenerating: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const gen = GENERATORS.find((g) => g.type === output.type)!;
  const handleCopy = () => { navigator.clipboard.writeText(output.content); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Copiado!"); };
  const handleExport = () => exportAsPdf({ documentTitle: gen.label, legalBasis: "Lei 14.133/2021", sections: [{ title: gen.label, content: output.content }] });
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
          <button onClick={handleExport} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Exportar PDF"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button onClick={() => onRegenerate(output.type)} disabled={isRegenerating} className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40" title="Gerar novamente"><RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button onClick={() => { if (confirm(`Excluir "${gen.label}"?`)) onDelete(output.type); }} disabled={isRegenerating} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-40" title="Excluir"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
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

// ── Audio Overview Player ─────────────────────────────────────
const AudioOverviewPlayer = ({ overview, onClose, onDelete }: { overview: AudioOverview; onClose: () => void; onDelete: () => void }) => {
  const { currentIdx, isPlaying, isLoading, play, pause, prev, next, seek } = useAudioPlayer(overview.segments);
  const [showScript, setShowScript] = useState(false);
  const current = overview.segments[currentIdx];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-accent">Visão Geral em Áudio</span>
          <span className="text-[10px] text-muted-foreground">{overview.generatedAt}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { if (confirm("Excluir esta visão geral em áudio?")) onDelete(); }} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Fechar"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Speaker + text */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-3 mb-4">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm border-2",
            current?.speaker === "A" ? "bg-blue-500/10 border-blue-500/30 text-blue-600" : "bg-purple-500/10 border-purple-500/30 text-purple-600")}>
            {current?.speaker === "A" ? "Ana" : "Car"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">
              {current?.speaker === "A" ? "Ana · Especialista Jurídica" : "Carlos · Consultor de Licitações"}
            </p>
            <p className="text-sm text-foreground leading-relaxed line-clamp-4">{current?.text}</p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {overview.segments.map((seg, i) => (
            <button key={i} onClick={() => seek(i)}
              className={cn("h-2 rounded-full transition-all",
                i === currentIdx ? "w-6 bg-accent" : seg.speaker === "A" ? "w-2 bg-blue-400/40 hover:bg-blue-400/70" : "w-2 bg-purple-400/40 hover:bg-purple-400/70")} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={prev} disabled={currentIdx === 0} className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-30">
            <SkipBack className="h-4 w-4 text-foreground" />
          </button>
          <button onClick={isPlaying ? pause : play}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90 transition-colors">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button onClick={next} disabled={currentIdx === overview.segments.length - 1} className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-30">
            <SkipForward className="h-4 w-4 text-foreground" />
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          {currentIdx + 1} / {overview.segments.length} · {isPlaying ? "Reproduzindo" : "Pausado"}
        </p>
      </div>

      {/* Transcript toggle */}
      <div className="border-t border-accent/20">
        <button onClick={() => setShowScript(!showScript)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          Ver transcrição completa
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showScript && "rotate-90")} />
        </button>
        {showScript && (
          <div className="px-4 pb-4 max-h-72 overflow-y-auto space-y-3">
            {overview.segments.map((seg, i) => (
              <div key={i} className={cn("flex gap-2.5", i === currentIdx && "opacity-100 font-medium", i !== currentIdx && "opacity-60")}>
                <span className={cn("text-[10px] font-bold shrink-0 mt-0.5 px-1.5 py-0.5 rounded",
                  seg.speaker === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                  {seg.speaker === "A" ? "ANA" : "CARLOS"}
                </span>
                <p className="text-xs text-foreground leading-relaxed">{seg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── Studio Panel ──────────────────────────────────────────────
const StudioPanel = ({
  sources, outputs, generating, onGenerate, onDeleteOutput, audioOverview, audioLoading, onGenerateAudio, onDeleteAudio,
}: {
  sources: Source[];
  outputs: GeneratedOutput[];
  generating: GeneratorType | null;
  onGenerate: (type: GeneratorType) => void;
  onDeleteOutput: (type: GeneratorType) => void;
  audioOverview: AudioOverview | null;
  audioLoading: boolean;
  onGenerateAudio: () => void;
  onDeleteAudio: () => void;
}) => {
  const activeCount = sources.filter((s) => s.active).length;
  const [view, setView]               = useState<"buttons" | "outputs">("buttons");
  const [showAudio, setShowAudio]     = useState(false);

  useEffect(() => { if (outputs.length > 0) setView("outputs"); }, [outputs.length]);
  useEffect(() => { if (audioOverview) setShowAudio(true); }, [audioOverview]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Estúdio de Análise</span>
        </div>
        <div className="flex gap-1">
          {(["buttons", "outputs"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors relative",
                view === v ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary")}>
              {v === "buttons" ? "Gerar" : "Resultados"}
              {v === "outputs" && outputs.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-white text-[9px] font-bold">{outputs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "buttons" ? (
            <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
              {/* Audio Overview — featured */}
              <div className="rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                    <Headphones className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Visão Geral em Áudio</p>
                    <p className="text-xs text-muted-foreground leading-snug">IA gera um podcast com Ana e Carlos discutindo seus documentos</p>
                  </div>
                </div>

                {showAudio && audioOverview ? (
                  <AudioOverviewPlayer overview={audioOverview} onClose={() => setShowAudio(false)} onDelete={onDeleteAudio} />
                ) : (
                  <Button variant="gold" size="sm" className="w-full" onClick={audioOverview ? () => setShowAudio(true) : onGenerateAudio} disabled={activeCount === 0 || audioLoading}>
                    {audioLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando áudio… (pode levar ~1 min)</>
                    ) : audioOverview ? (
                      <><Play className="h-4 w-4 mr-2" /> Abrir áudio salvo</>
                    ) : (
                      <><Headphones className="h-4 w-4 mr-2" /> Gerar Visão Geral em Áudio</>
                    )}
                  </Button>
                )}
                {audioOverview && !audioLoading && (
                  <button onClick={onGenerateAudio} disabled={activeCount === 0} className="mt-2 w-full text-[11px] text-muted-foreground hover:text-accent transition-colors disabled:opacity-50">
                    Gerar novamente com as fontes atuais
                  </button>
                )}
                {activeCount === 0 && <p className="text-[10px] text-muted-foreground text-center mt-2">Ative pelo menos uma fonte</p>}
              </div>

              <div className="pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-2">Análises escritas</p>
                {GENERATORS.map((gen) => {
                  const isGen = generating === gen.type;
                  const done  = outputs.find((o) => o.type === gen.type);
                  return (
                    <button key={gen.type} onClick={() => onGenerate(gen.type)}
                      disabled={activeCount === 0 || !!generating}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border group mb-1.5",
                        isGen ? "border-accent/40 bg-accent/5" : done ? "border-accent/20 hover:border-accent/30" : "border-border hover:border-accent/20 hover:bg-secondary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}>
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors", isGen ? "bg-accent/20" : "bg-secondary group-hover:bg-accent/10")}>
                        {isGen ? <Loader2 className="h-4 w-4 text-accent animate-spin" /> : <gen.icon className={cn("h-4 w-4", gen.color)} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{gen.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{gen.description}</p>
                      </div>
                      {done && !isGen ? <CheckCheck className="h-4 w-4 text-accent shrink-0" /> : !isGen ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" /> : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div key="outputs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              {outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="h-10 w-10 text-accent/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda</p>
                  <button onClick={() => setView("buttons")} className="mt-3 text-xs text-accent hover:underline">Ir para Gerar →</button>
                </div>
              ) : (
                [...outputs].reverse().map((output) => (
                  <OutputCard key={output.type} output={output} onRegenerate={onGenerate} onDelete={onDeleteOutput} isRegenerating={generating === output.type} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Citação clicável dentro da resposta ───────────────────────
const CitationChip = ({ n, citations, onOpen }: { n: number; citations?: Citation[]; onOpen: (c: Citation) => void }) => {
  const c = citations?.find((x) => x.index === n);
  if (!c) {
    return (
      <span title="Esta fonte não foi consultada nesta resposta — verifique a informação"
        className="inline-flex items-center align-baseline rounded-md border border-dashed border-muted-foreground/40 px-1.5 text-[11px] font-medium text-muted-foreground line-through decoration-muted-foreground/60 mx-0.5">
        Fonte {n}
      </span>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(c)} title={`${c.title}${c.excerpts.length ? ` · ${c.excerpts.length} trecho${c.excerpts.length > 1 ? "s" : ""}` : ""}`}
      className="inline-flex items-center gap-0.5 align-baseline rounded-md bg-accent/10 hover:bg-accent/20 border border-accent/30 px-1.5 text-[11px] font-semibold text-accent transition-colors mx-0.5">
      <Quote className="h-2.5 w-2.5" /> Fonte {n}
    </button>
  );
};

// ── Chat Panel ────────────────────────────────────────────────
const WELCOME_TEXT = "Olá! Sou seu assistente jurídico no Notebook IA.\n\nCarregue documentos, importe URLs ou faça buscas na web para adicionar fontes — e me faça perguntas sobre elas. Cada resposta traz os trechos usados: clique em **[Fonte N]** para abrir o documento no ponto citado.\n\nPosso ajudar com:\n- **Interpretação** de cláusulas e artigos\n- **Análise de preços** e referências de mercado\n- **Dúvidas** sobre a Lei 14.133/2021\n- **Comparação** entre documentos";

const ChatPanel = ({
  sources, notebookId, userId, userEmail, onOpenCitation,
}: {
  sources: Source[];
  notebookId: string;
  userId: string;
  userEmail: string;
  onOpenCitation: (c: Citation) => void;
}) => {
  const welcomeMsg = useMemo<ChatMessage>(() => ({ id: "welcome", role: "assistant", content: WELCOME_TEXT, timestamp: nowStr(), persisted: false }), []);

  const [messages, setMessages]   = useState<ChatMessage[]>([welcomeMsg]);
  const [history, setHistory]     = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput]         = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Load persisted messages on mount
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("notebook_messages")
        .select("*")
        .eq("notebook_id", notebookId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (data && data.length > 0) {
        const loaded: ChatMessage[] = data.map((r: any) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          timestamp: new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          persisted: true,
          citations: Array.isArray(r.citations) ? (r.citations as Citation[]) : undefined,
        }));
        setMessages([welcomeMsg, ...loaded]);
        setHistory(data.map((r: any) => ({ role: r.role as "user" | "assistant", content: r.content })));
      }
      setLoaded(true);
    };
    load();
    return () => { active = false; };
  }, [notebookId, welcomeMsg]);

  const saveMessage = async (role: "user" | "assistant", content: string, citations?: Citation[]): Promise<string | null> => {
    const { data, error } = await supabase.from("notebook_messages").insert({
      notebook_id: notebookId,
      user_id: userId,
      role,
      content,
      citations: citations && citations.length ? (citations as unknown as Json) : null,
    }).select().single();
    if (error) return null;
    return data?.id ?? null;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsgId = await saveMessage("user", text) ?? uid();
    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: text, timestamp: nowStr(), persisted: true };
    const newHistory = [...history, { role: "user" as const, content: text }];

    setMessages((prev) => [...prev, userMsg]);
    setHistory(newHistory);
    setInput("");
    setIsTyping(true);

    // RAG: busca os trechos mais relevantes nas fontes indexadas
    const active = sources.filter((s) => s.active);
    let chunks: RetrievedChunk[] = [];
    const embeddedIds = active.filter((s) => s.embedStatus === "done").map((s) => s.id);
    if (embeddedIds.length) {
      try { chunks = await searchChunks(text, embeddedIds, RAG_CHAT_CHUNKS); }
      catch (err) { toast.warning(`Busca nas fontes falhou (${err instanceof Error ? err.message : "erro"}); respondendo com o texto integral limitado.`); }
    }
    const ctx = buildContext(active, chunks);

    const aiId  = uid();
    let accumulated = "";
    const citations = ctx?.citations;
    const window = newHistory.slice(-HISTORY_WINDOW);
    const chatMessages = ctx
      ? [
          { role: "user" as const, content: `[CONTEXTO DO NOTEBOOK]\n${ctx.prompt}` },
          { role: "assistant" as const, content: "Entendido. Li os trechos e estou pronto." },
          ...window,
        ]
      : window;

    setMessages((prev) => [...prev, { id: aiId, role: "assistant", content: "", timestamp: nowStr(), citations }]);

    streamChat({
      messages: chatMessages,
      usuarioId: userEmail,
      onDelta: (chunk) => {
        accumulated += chunk;
        setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: accumulated } : m));
      },
      onDone: async () => {
        setIsTyping(false);
        if (!accumulated) { setMessages((prev) => prev.filter((m) => m.id !== aiId)); return; }
        setHistory((prev) => [...prev, { role: "assistant", content: accumulated }]);
        const savedId = await saveMessage("assistant", accumulated, citations);
        if (savedId) {
          setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, id: savedId, persisted: true } : m));
        }
      },
      onError: (err) => { toast.error(err); setIsTyping(false); setMessages((prev) => prev.filter((m) => m.id !== aiId || m.content)); },
    });
  };

  const clearChat = async () => {
    if (!confirm("Apagar toda a conversa deste notebook? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("notebook_messages").delete().eq("notebook_id", notebookId);
    if (error) { toast.error("Não foi possível apagar a conversa"); return; }
    setMessages([{ ...welcomeMsg, id: uid() }]);
    setHistory([]);
    toast.success("Conversa apagada");
  };

  const activeCount = sources.filter((s) => s.active).length;
  const indexedCount = sources.filter((s) => s.active && s.embedStatus === "done").length;

  const markdownComponents = (citations?: Citation[]) => ({
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const m = href?.match(/^#cite-(\d+)$/);
      if (m) return <CitationChip n={Number(m[1])} citations={citations} onOpen={onOpenCitation} />;
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{children}</a>;
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Chat Jurídico</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent" title={`${indexedCount} de ${activeCount} fontes indexadas para busca semântica`}>
              {activeCount} fonte{activeCount > 1 ? "s" : ""} ativa{activeCount > 1 ? "s" : ""}{indexedCount < activeCount ? ` · ${indexedCount} indexada${indexedCount === 1 ? "" : "s"}` : ""}
            </span>
          )}
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Trash2 className="h-3.5 w-3.5" /> Limpar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!loaded && (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-muted-foreground animate-spin" /></div>
        )}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => {
            const used = msg.citations?.filter((c) => c.excerpts.length > 0 || msg.citations!.every((x) => x.excerpts.length === 0)) ?? [];
            const isStreamingEmpty = msg.role === "assistant" && !msg.content;
            if (isStreamingEmpty) return null;
            return (
            <motion.div key={msg.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-0.5">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div className={cn("max-w-[78%] space-y-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md")}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1">
                      <ReactMarkdown components={markdownComponents(msg.citations)}>{linkifyCitations(msg.content)}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "assistant" && used.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-muted-foreground mr-0.5">Fontes consultadas:</span>
                    {used.map((c) => (
                      <button key={c.index} type="button" onClick={() => onOpenCitation(c)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card hover:border-accent/40 hover:text-accent px-2 py-0.5 text-[10px] text-muted-foreground transition-colors max-w-[220px]">
                        <span className="font-semibold shrink-0">{c.index}</span>
                        <span className="truncate">{c.title}</span>
                        {c.excerpts.length > 0 && <span className="shrink-0 opacity-70">· {c.excerpts.length}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className={cn("flex items-center gap-1", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.role === "assistant" && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copiado!"); }} className="p-1 rounded hover:bg-secondary transition-colors">
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
          );})}
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

      {messages.length <= 2 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button key={action} onClick={() => sendMessage(action)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/30 hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all">
              {action}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-4 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/40 transition-all">
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Pergunte sobre os documentos… (Enter para enviar)"
            disabled={isTyping} rows={1}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1"
            style={{ maxHeight: 120 }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }} />
          <Button variant="gold" size="icon" className="h-8 w-8 shrink-0" onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}>
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};


// ── Notebook List Page ────────────────────────────────────────
const NotebookList = ({
  notebooks, loading, onCreate, onOpen, onDelete,
}: {
  notebooks: Notebook[];
  loading: boolean;
  onCreate: (title: string) => Promise<void>;
  onOpen: (nb: Notebook) => void;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState("");
  const [creating, setCreating]     = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    await onCreate(newTitle.trim());
    setCreating(false);
    setNewTitle("");
    setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <BookCopy className="h-7 w-7 text-accent" /> Notebooks IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Organize seus documentos jurídicos em notebooks independentes</p>
        </div>
        <Button variant="gold" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Notebook
        </Button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-5">
          <p className="text-sm font-semibold mb-3">Nome do novo notebook</p>
          <div className="flex gap-3">
            <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ex: Edital PE 023/2026, Contrato TI, ETP Limpeza..." className="flex-1" />
            <Button variant="gold" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 text-muted-foreground animate-spin" /></div>
      ) : notebooks.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary border border-dashed border-border mb-4">
            <BookMarked className="h-9 w-9 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum notebook ainda</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Crie seu primeiro notebook para começar a organizar e analisar documentos de licitação com IA
          </p>
          <Button variant="gold" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar primeiro notebook
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {notebooks.map((nb) => (
              <motion.div key={nb.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                className="group relative rounded-2xl border border-border bg-card hover:border-accent/30 hover:shadow-md transition-all cursor-pointer"
                onClick={() => onOpen(nb)}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                      <BookMarked className="h-5 w-5 text-accent" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm("Apagar este notebook e todas as suas fontes?")) onDelete(nb.id); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{nb.title}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{nb.sourceCount ?? 0} fonte{(nb.sourceCount ?? 0) !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{new Date(nb.updatedAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30 rounded-b-2xl">
                  <span className="text-xs text-accent font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Notebook IA
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ── Notebook View ─────────────────────────────────────────────
const NotebookView = ({
  notebook, userId, userEmail, onBack, onTitleChange,
}: {
  notebook: Notebook;
  userId: string;
  userEmail: string;
  onBack: () => void;
  onTitleChange: (id: string, title: string) => void;
}) => {
  const [sources, setSources]         = useState<Source[]>([]);
  const [loadingSources, setLoading]  = useState(true);
  const [showAddModal, setShowAdd]    = useState(false);
  const [viewingSource, setViewing]   = useState<Source | null>(null);
  const [highlights, setHighlights]   = useState<CitationExcerpt[]>([]);
  const [outputs, setOutputs]         = useState<GeneratedOutput[]>([]);
  const [generating, setGenerating]   = useState<GeneratorType | null>(null);
  const [audioOverview, setAudio]     = useState<AudioOverview | null>(null);
  const [audioLoading, setAudioLoad]  = useState(false);
  const [editingTitle, setEditTitle]  = useState(false);
  const [title, setTitle]             = useState(notebook.title);
  const indexing = useRef<Set<string>>(new Set());

  const setSourceStatus = (id: string, patch: Partial<Source>) =>
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));

  // Indexa uma fonte (chunks + embeddings) e reflete o status no card
  const indexSource = useCallback(async (id: string) => {
    if (indexing.current.has(id)) return;
    indexing.current.add(id);
    setSourceStatus(id, { embedStatus: "processing", embedError: undefined });
    try {
      const { chunks_count } = await embedSourceRemote(id);
      setSourceStatus(id, { embedStatus: "done", chunkCount: chunks_count });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSourceStatus(id, { embedStatus: "error", embedError: message });
      toast.error(`Falha ao indexar fonte: ${message}`);
    } finally {
      indexing.current.delete(id);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: srcRows }, { data: outRows }, { data: audioRow }] = await Promise.all([
        supabase.from("notebook_sources").select("*").eq("notebook_id", notebook.id).order("created_at", { ascending: true }),
        supabase.from("notebook_outputs").select("*").eq("notebook_id", notebook.id).order("updated_at", { ascending: true }),
        supabase.from("notebook_audio_overviews").select("*").eq("notebook_id", notebook.id).maybeSingle(),
      ]);
      if (!active) return;

      const loadedSources = (srcRows || []).map(mapSource);
      setSources(loadedSources);
      setLoading(false);

      setOutputs((outRows || []).map((r) => ({ type: r.type as GeneratorType, content: r.content, generatedAt: timeOf(r.updated_at || r.created_at) })));

      if (audioRow) {
        const segments = await signAudio((audioRow.segments as unknown as AudioSegment[]) || []);
        if (active) setAudio({ id: audioRow.id, segments, script: audioRow.script, generatedAt: timeOf(audioRow.created_at) });
      }

      // Fontes antigas (anteriores ao RAG) são indexadas automaticamente, uma por vez
      for (const s of loadedSources) {
        if (!active) break;
        if (s.embedStatus === "pending") await indexSource(s.id);
      }
    };
    load();
    return () => { active = false; };
  }, [notebook.id, indexSource]);

  const addSource = async (data: NewSource) => {
    const { data: row, error } = await supabase
      .from("notebook_sources")
      .insert({ notebook_id: notebook.id, user_id: userId, title: data.title, content: data.content, type: data.type, active: data.active, char_count: data.charCount, source_url: data.sourceUrl || null })
      .select().single();
    if (error || !row) { toast.error(`Erro ao salvar: ${error?.message}`); return; }
    setSources((prev) => [...prev, mapSource(row)]);
    await supabase.from("notebooks").update({ updated_at: new Date().toISOString() }).eq("id", notebook.id);
    indexSource(row.id);
  };

  const toggleSource = async (id: string) => {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    const { error } = await supabase.from("notebook_sources").update({ active: !src.active }).eq("id", id);
    if (!error) setSources((prev) => prev.map((s) => s.id === id ? { ...s, active: !s.active } : s));
  };

  const deleteSource = async (id: string) => {
    const { error } = await supabase.from("notebook_sources").delete().eq("id", id);
    if (!error) { setSources((prev) => prev.filter((s) => s.id !== id)); toast.success("Fonte removida"); }
    else toast.error("Erro ao remover fonte");
  };

  const setAllActive = async (active: boolean) => {
    await supabase.from("notebook_sources").update({ active }).eq("notebook_id", notebook.id);
    setSources((prev) => prev.map((s) => ({ ...s, active })));
  };

  const openCitation = (c: Citation) => {
    const src = sources.find((s) => s.id === c.sourceId);
    if (!src) { toast.error("Esta fonte foi removida do notebook."); return; }
    setHighlights(c.excerpts);
    setViewing(src);
  };

  const viewSource = (src: Source) => { setHighlights([]); setViewing(src); };

  const generateAnalysis = useCallback(async (type: GeneratorType) => {
    const activeSources = sources.filter((s) => s.active);
    if (!activeSources.length) { toast.error("Ative pelo menos uma fonte"); return; }
    const gen = GENERATORS.find((g) => g.type === type)!;
    setGenerating(type);

    let chunks: RetrievedChunk[] = [];
    const embeddedIds = activeSources.filter((s) => s.embedStatus === "done").map((s) => s.id);
    if (embeddedIds.length) {
      try { chunks = await searchChunks(`${gen.label}: ${gen.prompt}`, embeddedIds, RAG_STUDIO_CHUNKS); }
      catch { /* cai no texto integral limitado */ }
    }
    const ctx = buildContext(activeSources, chunks);
    const chatMessages = ctx
      ? [{ role: "user" as const, content: `[CONTEXTO DO NOTEBOOK]\n${ctx.prompt}` }, { role: "assistant" as const, content: "Entendido." }, { role: "user" as const, content: gen.prompt }]
      : [{ role: "user" as const, content: gen.prompt }];

    let accumulated = "";
    const generatedAt = nowStr();
    streamChat({
      messages: chatMessages,
      usuarioId: userEmail,
      onDelta: (chunk) => {
        accumulated += chunk;
        setOutputs((prev) => [...prev.filter((o) => o.type !== type), { type, content: accumulated, generatedAt }]);
      },
      onDone: async () => {
        setGenerating(null);
        if (!accumulated) { toast.error("A análise voltou vazia. Tente novamente."); return; }
        const { error } = await supabase
          .from("notebook_outputs")
          .upsert({ notebook_id: notebook.id, user_id: userId, type, content: accumulated }, { onConflict: "notebook_id,type" });
        if (error) toast.error("Análise gerada, mas não foi salva.");
        else toast.success(`${gen.label} gerado e salvo!`);
      },
      onError: (err) => { toast.error(`Erro: ${err}`); setGenerating(null); },
    });
  }, [sources, userEmail, notebook.id, userId]);

  const deleteOutput = async (type: GeneratorType) => {
    const { error } = await supabase.from("notebook_outputs").delete().eq("notebook_id", notebook.id).eq("type", type);
    if (error) { toast.error("Não foi possível excluir"); return; }
    setOutputs((prev) => prev.filter((o) => o.type !== type));
  };

  const generateAudio = async () => {
    const activeSources = sources.filter((s) => s.active);
    if (!activeSources.length) { toast.error("Ative pelo menos uma fonte"); return; }
    setAudioLoad(true);
    try {
      const data = await callFn<{ id: string; createdAt: string; script: string; segments: AudioSegment[] }>("audio-overview", { notebookId: notebook.id });
      const segments = await signAudio(data.segments);
      setAudio({ id: data.id, segments, script: data.script, generatedAt: timeOf(data.createdAt) });
      toast.success("Áudio gerado e salvo!");
    } catch (err) {
      toast.error(`Erro ao gerar áudio: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAudioLoad(false);
    }
  };

  const deleteAudio = async () => {
    if (!audioOverview) return;
    const paths = audioOverview.segments.map((s) => s.path).filter(Boolean);
    if (paths.length) await supabase.storage.from(AUDIO_BUCKET).remove(paths);
    const { error } = await supabase.from("notebook_audio_overviews").delete().eq("id", audioOverview.id);
    if (error) { toast.error("Não foi possível excluir o áudio"); return; }
    setAudio(null);
    toast.success("Áudio excluído");
  };

  const saveTitle = async () => {
    setEditTitle(false);
    if (title !== notebook.title) {
      await supabase.from("notebooks").update({ title, updated_at: new Date().toISOString() }).eq("id", notebook.id);
      onTitleChange(notebook.id, title);
    }
  };

  const activeCount   = sources.filter((s) => s.active).length;
  const indexedCount  = sources.filter((s) => s.embedStatus === "done").length;
  const processing    = sources.some((s) => s.embedStatus === "processing");

  const SourcesListContent = (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {loadingSources ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 text-muted-foreground animate-spin" /></div>
          ) : sources.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-dashed border-border mb-3">
                <FileText className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma fonte</p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed mb-3">Adicione editais, TRs, ETPs, importe URLs ou busque dados de preços na web</p>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
            </motion.div>
          ) : (
            sources.map((s) => (
              <SourceCard key={s.id} source={s} onToggle={toggleSource} onDelete={deleteSource} onView={viewSource} onReindex={indexSource} />
            ))
          )}
        </AnimatePresence>
      </div>
      {sources.length > 0 && (
        <div className="border-t border-border px-4 py-3 flex justify-between shrink-0">
          <button onClick={() => setAllActive(true)} className="text-[11px] text-muted-foreground hover:text-accent transition-colors font-medium">Ativar todas</button>
          <button onClick={() => setAllActive(false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Desativar todas</button>
        </div>
      )}
    </>
  );

  const studio = (
    <StudioPanel sources={sources} outputs={outputs} generating={generating} onGenerate={generateAnalysis} onDeleteOutput={deleteOutput}
      audioOverview={audioOverview} audioLoading={audioLoading} onGenerateAudio={generateAudio} onDeleteAudio={deleteAudio} />
  );

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            {editingTitle ? (
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="text-xl font-bold bg-transparent border-b-2 border-accent focus:outline-none pb-0.5 text-foreground"
                style={{ width: Math.max(200, title.length * 12) + "px" }} />
            ) : (
              <button onClick={() => setEditTitle(true)} className="flex items-center gap-2 group text-left">
                <h1 className="text-xl font-bold text-foreground">{title}</h1>
                <PenLine className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{activeCount} de {sources.length} fonte{sources.length !== 1 ? "s" : ""} ativa{activeCount !== 1 ? "s" : ""}</span>
              {sources.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  · {processing && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                  {indexedCount} indexada{indexedCount !== 1 ? "s" : ""} para busca semântica
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 border border-accent/10 text-xs text-accent font-medium">
          <Sparkles className="h-3.5 w-3.5" /> IA Jurídica · Lei 14.133/2021
        </div>
      </div>

      {/* Mobile toolbars */}
      <div className="lg:hidden flex gap-2 mb-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1"><Layers className="h-4 w-4 mr-1.5" /> Fontes ({sources.length})</Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[88vw] sm:w-[380px]">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-accent" /><span className="text-sm font-semibold">Fontes</span>{sources.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{sources.length}</span>}</div>
                <Button variant="gold" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
              </div>
              {SourcesListContent}
            </div>
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 xl:hidden"><Sparkles className="h-4 w-4 mr-1.5" /> Studio</Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-[88vw] sm:w-[380px]">
            {studio}
          </SheetContent>
        </Sheet>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Left: Sources */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-accent" /><span className="text-sm font-semibold">Fontes</span>{sources.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{sources.length}</span>}</div>
            <Button variant="gold" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
          </div>
          {SourcesListContent}
        </div>

        {/* Center: Chat */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0">
          <ChatPanel sources={sources} notebookId={notebook.id} userId={userId} userEmail={userEmail} onOpenCitation={openCitation} />
        </div>

        {/* Right: Studio */}
        <div className="hidden xl:flex w-80 shrink-0 flex-col rounded-xl border border-border bg-card overflow-hidden">
          {studio}
        </div>
      </div>

      <SourceViewer source={viewingSource} highlights={highlights} onClose={() => { setViewing(null); setHighlights([]); }} />
      <AnimatePresence>
        {showAddModal && <AddSourceModal onAdd={addSource} onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
};


// ── Main Page ─────────────────────────────────────────────────
export default function NotebookPage() {
  const [notebooks, setNotebooks]         = useState<Notebook[]>([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [openNotebook, setOpenNotebook]   = useState<Notebook | null>(null);
  const [userId, setUserId]               = useState("");
  const [userEmail, setUserEmail]         = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || "");
      setUserEmail(data.user?.email || "");
    });
  }, []);

  const loadNotebooks = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);

    // Count sources per notebook
    const { data: nbs } = await supabase
      .from("notebooks")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (!nbs) { setLoadingList(false); return; }

    const ids = nbs.map((n: any) => n.id);
    const { data: counts } = ids.length
      ? await supabase.from("notebook_sources").select("notebook_id").in("notebook_id", ids)
      : { data: [] };

    const countMap: Record<string, number> = {};
    (counts || []).forEach((r: any) => { countMap[r.notebook_id] = (countMap[r.notebook_id] || 0) + 1; });

    setNotebooks(nbs.map((n: any) => ({ ...mapNotebook(n), sourceCount: countMap[n.id] || 0 })));

    // Auto-migrate orphaned sources (notebook_id IS NULL) into a default notebook
    const { data: orphaned } = await supabase
      .from("notebook_sources")
      .select("id")
      .eq("user_id", userId)
      .is("notebook_id", null)
      .limit(1);

    if (orphaned && orphaned.length > 0) {
      const { data: defNb } = await supabase
        .from("notebooks")
        .insert({ user_id: userId, title: "Notebook Migrado" })
        .select()
        .single();
      if (defNb) {
        await supabase.from("notebook_sources")
          .update({ notebook_id: defNb.id })
          .eq("user_id", userId)
          .is("notebook_id", null);
        setNotebooks((prev) => [{ ...mapNotebook(defNb), sourceCount: orphaned.length }, ...prev]);
        toast.success("Fontes anteriores migradas para 'Notebook Migrado'");
      }
    }

    setLoadingList(false);
  }, [userId]);

  useEffect(() => { if (userId) loadNotebooks(); }, [userId, loadNotebooks]);

  const createNotebook = async (title: string) => {
    const { data, error } = await supabase
      .from("notebooks")
      .insert({ user_id: userId, title })
      .select().single();
    if (error || !data) { toast.error("Erro ao criar notebook"); return; }
    const nb = { ...mapNotebook(data), sourceCount: 0 };
    setNotebooks((prev) => [nb, ...prev]);
    setOpenNotebook(nb);
  };

  const deleteNotebook = async (id: string) => {
    await supabase.from("notebooks").delete().eq("id", id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notebook removido");
  };

  const handleTitleChange = (id: string, title: string) => {
    setNotebooks((prev) => prev.map((n) => n.id === id ? { ...n, title } : n));
    if (openNotebook?.id === id) setOpenNotebook((prev) => prev ? { ...prev, title } : prev);
  };

  if (openNotebook) {
    return (
      <NotebookView
        notebook={openNotebook}
        userId={userId}
        userEmail={userEmail}
        onBack={() => { setOpenNotebook(null); loadNotebooks(); }}
        onTitleChange={handleTitleChange}
      />
    );
  }

  return (
    <NotebookList
      notebooks={notebooks}
      loading={loadingList}
      onCreate={createNotebook}
      onOpen={setOpenNotebook}
      onDelete={deleteNotebook}
    />
  );
}
