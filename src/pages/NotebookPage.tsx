import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  BookOpen, Plus, Trash2, FileText, Send, Bot, User, Copy, RotateCcw,
  Sparkles, X, Eye, EyeOff, Wand2, FileQuestion, ClipboardList,
  AlertTriangle, Calendar, Scale, HelpCircle, Loader2, CheckCheck,
  Upload, PenLine, Newspaper, Download, ChevronRight, MessageSquare,
  BookMarked, Paperclip, Search, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/streamChat";
import { extractPdfText } from "@/lib/pdfExtract";
import { exportAsPdf } from "@/lib/exportDocument";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────
interface Source {
  id: string;
  title: string;
  content: string;
  type: "text" | "pdf";
  active: boolean;
  charCount: number;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

type GeneratorType =
  | "summary"
  | "checklist"
  | "prazos"
  | "riscos"
  | "perguntas"
  | "modalidade";

interface GeneratedOutput {
  type: GeneratorType;
  content: string;
  generatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────
const SOURCES_KEY = "intelicite_notebook_sources";

const uid = () => Math.random().toString(36).slice(2, 10);
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
    description: "Síntese executiva dos documentos",
    icon: Newspaper,
    color: "text-blue-600",
    prompt:
      "Com base nos documentos fornecidos, redija um **Resumo Jurídico Executivo** completo cobrindo: (1) objeto da contratação, (2) valor estimado, (3) modalidade aplicável, (4) requisitos essenciais e (5) principais obrigações das partes. Use markdown com títulos e bullets. Seja preciso e cite artigos da Lei 14.133/2021 quando pertinente.",
  },
  {
    type: "checklist",
    label: "Checklist de Conformidade",
    description: "Verificação com a Lei 14.133/2021",
    icon: ClipboardList,
    color: "text-emerald-600",
    prompt:
      "Analise os documentos e gere um **Checklist de Conformidade** com a Lei 14.133/2021, estruturado por fases: Planejamento, Instrução do Processo, Edital/TR, e Execução. Para cada item informe: ✅ Conforme, ⚠️ Parcialmente conforme, ❌ Não conforme ou ❓ Informação ausente. Cite os artigos específicos da lei para cada item.",
  },
  {
    type: "prazos",
    label: "Mapa de Prazos",
    description: "Todos os prazos e obrigações extraídos",
    icon: Calendar,
    color: "text-amber-600",
    prompt:
      "Extraia e organize em tabela markdown **todos os prazos, datas-limite e obrigações temporais** presentes nos documentos. Colunas: | Prazo/Data | Descrição | Responsável | Base Legal |. Inclua prazos recursais, de habilitação, de entrega, de pagamento e qualquer outro prazo relevante. Se não houver data explícita, informe o prazo legal aplicável conforme Lei 14.133/2021.",
  },
  {
    type: "riscos",
    label: "Análise de Riscos",
    description: "Riscos jurídicos e pontos de atenção",
    icon: AlertTriangle,
    color: "text-red-600",
    prompt:
      "Realize uma **Análise de Riscos Jurídicos** dos documentos. Para cada risco identificado informe: Descrição do risco, Probabilidade (Alta/Média/Baixa), Impacto (Alto/Médio/Baixo), Base legal pertinente e Recomendação de mitigação. Organize por nível de criticidade, do mais crítico ao menos crítico. Destaque cláusulas potencialmente nulas ou ilegais.",
  },
  {
    type: "perguntas",
    label: "Pedido de Esclarecimentos",
    description: "Perguntas para enviar ao órgão licitante",
    icon: HelpCircle,
    color: "text-purple-600",
    prompt:
      "Com base nos documentos, elabore um **Pedido de Esclarecimentos** completo para envio ao órgão licitante. Liste pontos ambíguos, contraditórios, restritivos à competitividade ou que precisam de fundamentação adicional. Formule cada pergunta de forma técnica e objetiva, numeradas e referenciando o item/cláusula do documento. Inclua sugestão de como o órgão deveria responder.",
  },
  {
    type: "modalidade",
    label: "Diagnóstico de Modalidade",
    description: "Qual modalidade aplicar e por quê",
    icon: Scale,
    color: "text-cyan-600",
    prompt:
      "Analise os documentos e elabore um **Diagnóstico de Modalidade de Licitação** completo: (1) identifique o objeto e valor estimado, (2) determine a modalidade correta conforme Lei 14.133/2021 Arts. 28-32, (3) justifique a escolha com artigos específicos, (4) alerte se a modalidade usada estiver incorreta, (5) indique os procedimentos obrigatórios para a modalidade correta, (6) avalie cabimento de dispensa/inexigibilidade (Arts. 74-76).",
  },
];

const QUICK_ACTIONS = [
  "Qual a modalidade correta para este objeto?",
  "Liste todos os prazos recursais",
  "Há cláusulas restritivas à competitividade?",
  "O valor estimado está correto?",
  "Quais documentos de habilitação são exigidos?",
  "Esta dispensa tem fundamentação adequada?",
];

// ── Build system prompt from sources ─────────────────────────
const buildSystemPrompt = (sources: Source[]) => {
  const active = sources.filter((s) => s.active);
  if (!active.length) return undefined;

  const docs = active
    .map(
      (s, i) =>
        `### [Fonte ${i + 1}] ${s.title} (${s.type === "pdf" ? "PDF" : "Texto"})\n\n${s.content}`
    )
    .join("\n\n---\n\n");

  return `Você é um assistente jurídico especializado em licitações públicas e na Lei 14.133/2021 (Nova Lei de Licitações). Responda sempre em português do Brasil.

O usuário carregou os seguintes documentos para análise. Use-os como referência principal:

${docs}

---

Instruções:
- Cite as fontes pelo número ([Fonte 1], [Fonte 2], etc.) ao referenciar informações
- Quando relevante, cite os artigos da Lei 14.133/2021
- Seja preciso, técnico e objetivo
- Use markdown para formatar respostas longas`;
};

// ── Source Card ───────────────────────────────────────────────
const SourceCard = ({
  source,
  onToggle,
  onDelete,
}: {
  source: Source;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
    className={cn(
      "group relative rounded-xl border p-3 transition-all cursor-default",
      source.active
        ? "border-accent/30 bg-accent/5"
        : "border-border bg-secondary/30 opacity-60"
    )}
  >
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          source.active ? "bg-accent/10" : "bg-secondary"
        )}
      >
        {source.type === "pdf" ? (
          <FileText
            className={cn("h-4 w-4", source.active ? "text-accent" : "text-muted-foreground")}
          />
        ) : (
          <BookOpen
            className={cn("h-4 w-4", source.active ? "text-accent" : "text-muted-foreground")}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate text-foreground">{source.title}</p>
        <p className="text-[10px] mt-0.5 text-muted-foreground">
          {source.type === "pdf" ? "PDF · " : "Texto · "}
          {source.charCount.toLocaleString("pt-BR")} caracteres
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggle(source.id)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          title={source.active ? "Desativar" : "Ativar"}
        >
          {source.active ? (
            <Eye className="h-3.5 w-3.5 text-accent" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => onDelete(source.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  </motion.div>
);

// ── Add Source Modal ──────────────────────────────────────────
const AddSourceModal = ({
  onAdd,
  onClose,
}: {
  onAdd: (source: Omit<Source, "id" | "createdAt">) => void;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<"text" | "pdf">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await extractPdfText(file);
      setTitle(file.name.replace(".pdf", ""));
      setContent(text);
      toast.success(`PDF extraído: ${text.length.toLocaleString()} caracteres`);
    } catch {
      toast.error("Erro ao extrair PDF. Tente colar o texto manualmente.");
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = () => {
    if (!content.trim()) return;
    onAdd({
      title: title.trim() || "Documento sem título",
      content: content.trim(),
      type: tab,
      active: true,
      charCount: content.trim().length,
    });
    onClose();
  };

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
        className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" />
            Adicionar Fonte
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 pb-0">
          {(["text", "pdf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {t === "pdf" ? <FileText className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
              {t === "pdf" ? "Upload de PDF" : "Colar Texto"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {tab === "pdf" && (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-accent/40 bg-secondary/30 hover:bg-accent/5 transition-all cursor-pointer p-8"
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdf} />
              {uploading ? (
                <Loader2 className="h-8 w-8 text-accent animate-spin mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <p className="text-sm font-medium text-foreground">
                {uploading ? "Extraindo texto do PDF…" : "Clique para selecionar um PDF"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Extraímos o texto automaticamente (até 50 páginas)
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Título do documento
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Edital PE 023/2026, TR — Serviços de TI..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Conteúdo {tab === "pdf" && content ? "(extraído do PDF)" : ""}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole aqui o texto do edital, termo de referência, ETP, contrato ou qualquer documento jurídico..."
              rows={10}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {content.length.toLocaleString("pt-BR")} caracteres
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleAdd}
            disabled={!content.trim()}
          >
            <Plus className="h-4 w-4" />
            Adicionar Fonte
          </Button>
        </div>
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
      format: "pdf",
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <gen.icon className={cn("h-4 w-4", gen.color)} />
          <span className="text-sm font-semibold">{gen.label}</span>
          {isRegenerating && (
            <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">{output.generatedAt}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Copiar"
          >
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title="Exportar PDF"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => onRegenerate(output.type)}
            disabled={isRegenerating}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40"
            title="Regenerar"
          >
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

// ── Studio Panel (right) ──────────────────────────────────────
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Estúdio de Análise</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("buttons")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              view === "buttons" ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            Gerar
          </button>
          <button
            onClick={() => setView("outputs")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors relative",
              view === "outputs" ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            Resultados
            {outputs.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-white text-[9px] font-bold">
                {outputs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "buttons" ? (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-2"
            >
              {activeCount === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center mb-3">
                  <p className="text-xs text-muted-foreground">
                    Adicione e ative fontes no painel ao lado para gerar análises
                  </p>
                </div>
              )}
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
                      isGen
                        ? "border-accent/40 bg-accent/5"
                        : done
                        ? "border-accent/20 bg-accent/3 hover:border-accent/30"
                        : "border-border hover:border-accent/20 hover:bg-secondary/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                        isGen ? "bg-accent/20" : "bg-secondary group-hover:bg-accent/10"
                      )}
                    >
                      {isGen ? (
                        <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      ) : (
                        <gen.icon className={cn("h-4 w-4", gen.color)} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{gen.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{gen.description}</p>
                    </div>
                    {done && !isGen && (
                      <CheckCheck className="h-4 w-4 text-accent shrink-0" />
                    )}
                    {!done && !isGen && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="outputs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="h-10 w-10 text-accent/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda</p>
                  <button
                    onClick={() => setView("buttons")}
                    className="mt-3 text-xs text-accent hover:underline"
                  >
                    Ir para Gerar →
                  </button>
                </div>
              ) : (
                [...outputs].reverse().map((output) => (
                  <OutputCard
                    key={output.type}
                    output={output}
                    onRegenerate={onGenerate}
                    isRegenerating={generating === output.type}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Chat Panel (center) ───────────────────────────────────────
const ChatPanel = ({ sources }: { sources: Source[] }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Olá! Sou seu assistente jurídico no modo Notebook.\n\nCarregue documentos no painel esquerdo (editais, TRs, ETPs, contratos) e posso ajudar com:\n\n- **Interpretação** de cláusulas e artigos\n- **Comparação** entre documentos\n- **Dúvidas** sobre a Lei 14.133/2021\n- **Análise** de pontos específicos\n\nCite `[Fonte 1]` ou `[Fonte 2]` para referenciar um documento específico.",
      timestamp: nowStr(),
    },
  ]);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
    });
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

    // Build messages with system context injected as first user message if sources exist
    const systemPrompt = buildSystemPrompt(sources);
    const chatMessages = systemPrompt
      ? [{ role: "user" as const, content: `[CONTEXTO DO NOTEBOOK]\n${systemPrompt}` }, { role: "assistant" as const, content: "Entendido. Li todos os documentos fornecidos e estou pronto para responder com base neles." }, ...newHistory]
      : newHistory;

    streamChat({
      messages: chatMessages,
      usuarioId: userEmail,
      onDelta: (chunk) => {
        accumulated += chunk;
        const botMsg: ChatMessage = {
          id: aiId,
          role: "assistant",
          content: accumulated,
          timestamp: nowStr(),
        };
        setMessages((prev) => {
          const withoutStreaming = prev.filter((m) => m.id !== aiId);
          return [...withoutStreaming, botMsg];
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: uid(),
        role: "assistant",
        content: "Conversa reiniciada. Como posso ajudar com os documentos?",
        timestamp: nowStr(),
      },
    ]);
    setHistory([]);
  };

  const copyMsg = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado!");
  };

  const activeCount = sources.filter((s) => s.active).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Chat Jurídico</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              {activeCount} doc{activeCount > 1 ? "s" : ""} ativo{activeCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-0.5">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div className={cn("max-w-[78%] space-y-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1 [&>ol]:mt-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <div className={cn("flex items-center gap-1", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => copyMsg(msg.content)}
                      className="p-1 rounded hover:bg-secondary transition-colors"
                    >
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
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/30 hover:bg-accent/5 text-muted-foreground hover:text-accent transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent/40 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre os documentos... (Enter para enviar, Shift+Enter para nova linha)"
            disabled={isTyping}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <Button
            variant="gold"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
export default function NotebookPage() {
  const [sources, setSources] = useState<Source[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SOURCES_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [generating, setGenerating] = useState<GeneratorType | null>(null);
  const [notebookTitle, setNotebookTitle] = useState("Notebook Jurídico");
  const [editingTitle, setEditingTitle] = useState(false);
  const [rightTab, setRightTab] = useState<"studio" | "none">("studio");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
    });
  }, []);

  // Persist sources
  useEffect(() => {
    localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
  }, [sources]);

  const addSource = (data: Omit<Source, "id" | "createdAt">) => {
    setSources((prev) => [
      ...prev,
      { ...data, id: uid(), createdAt: new Date().toISOString() },
    ]);
    toast.success("Fonte adicionada!");
  };

  const toggleSource = (id: string) =>
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));

  const deleteSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    toast.success("Fonte removida");
  };

  const generateAnalysis = useCallback(
    async (type: GeneratorType) => {
      const activeSources = sources.filter((s) => s.active);
      if (!activeSources.length) {
        toast.error("Ative pelo menos uma fonte para gerar análises");
        return;
      }

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
        onDone: () => {
          setGenerating(null);
          toast.success(`${gen.label} gerado!`);
        },
        onError: (err) => {
          toast.error(`Erro: ${err}`);
          setGenerating(null);
        },
      });
    },
    [sources, userEmail]
  );

  const activeCount = sources.filter((s) => s.active).length;
  const totalChars = sources
    .filter((s) => s.active)
    .reduce((a, s) => a + s.charCount, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 gap-0">
      {/* Page header */}
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
              <button
                onClick={() => setEditingTitle(true)}
                className="flex items-center gap-2 group text-left"
              >
                <h1 className="text-xl font-bold text-foreground">{notebookTitle}</h1>
                <PenLine className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {sources.length} fonte{sources.length !== 1 ? "s" : ""} ·{" "}
              {activeCount} ativa{activeCount !== 1 ? "s" : ""} ·{" "}
              {(totalChars / 1000).toFixed(1)}k caracteres em contexto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 border border-accent/10 text-xs text-accent font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Análise com IA · Lei 14.133/2021
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Left: Sources */}
        <div className="w-72 shrink-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">Fontes</span>
              {sources.length > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                  {sources.length}
                </span>
              )}
            </div>
            <Button variant="gold" size="sm" className="h-7 px-3 text-xs" onClick={() => setShowAddModal(true)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {sources.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center px-4"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-dashed border-border mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma fonte</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 leading-relaxed">
                    Adicione editais, TRs, ETPs ou qualquer documento jurídico
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Upload className="h-3.5 w-3.5" /> Adicionar documento
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
              <button
                onClick={() => setSources((prev) => prev.map((s) => ({ ...s, active: true })))}
                className="text-[11px] text-muted-foreground hover:text-accent transition-colors font-medium"
              >
                Ativar todas
              </button>
              <button
                onClick={() => setSources((prev) => prev.map((s) => ({ ...s, active: false })))}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Desativar todas
              </button>
            </div>
          )}
        </div>

        {/* Center: Chat */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden min-w-0">
          <ChatPanel sources={sources} />
        </div>

        {/* Right: Studio */}
        <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <StudioPanel
            sources={sources}
            outputs={outputs}
            generating={generating}
            onGenerate={generateAnalysis}
          />
        </div>
      </div>

      {/* Add source modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddSourceModal onAdd={addSource} onClose={() => setShowAddModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
