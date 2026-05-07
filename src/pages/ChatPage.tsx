import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Plus,
  Search,
  Bot,
  User,
  FileText,
  Trash2,
  Download,
  BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/streamChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: string[];
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  date: string;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Modalidade para TI",
    lastMessage: "Para contratações de TI acima de...",
    date: "Hoje",
    messages: [
      {
        id: "m1",
        role: "user",
        content: "Qual a modalidade correta para contratação de serviços de TI no valor de R$ 500.000?",
        timestamp: new Date(),
      },
      {
        id: "m2",
        role: "assistant",
        content:
          "De acordo com a **Lei nº 14.133/2021**, para contratações de serviços de TI no valor de R$ 500.000,00, a modalidade recomendada é o **Pregão Eletrônico** (Art. 28, I).\n\n**Fundamentação legal:**\n- Art. 6º, XLI — Define serviços comuns\n- Art. 28, I — Pregão para bens e serviços comuns\n- IN SGD/ME nº 94/2022 — Contratações de TI\n\n**Pontos de atenção:**\n1. Necessidade de Estudo Técnico Preliminar (ETP)\n2. Termo de Referência com especificações técnicas\n3. Pesquisa de preços com no mínimo 3 fontes\n4. Análise de riscos conforme Art. 18, X",
        timestamp: new Date(),
      },
    ],
  },
  {
    id: "2",
    title: "Dispensa de licitação",
    lastMessage: "A dispensa pode ser aplicada...",
    date: "Ontem",
    messages: [
      {
        id: "m3",
        role: "user",
        content: "Quando posso usar dispensa de licitação?",
        timestamp: new Date(),
      },
      {
        id: "m4",
        role: "assistant",
        content:
          "A **dispensa de licitação** está prevista nos Arts. 74 e 75 da Lei 14.133/2021.\n\n**Principais hipóteses (Art. 75):**\n\n1. **Por valor** (incisos I e II):\n   - Obras/serviços de engenharia: até R$ 100.000,00\n   - Outros serviços/compras: até R$ 50.000,00\n\n2. **Emergência** (inciso VIII):\n   - Situação que possa causar prejuízo ou comprometer segurança\n   - Prazo máximo: 1 ano, improrrogável\n\n3. **Específicas** (diversos incisos):\n   - Locação de imóvel para administração\n   - Contratação de instituição sem fins lucrativos\n   - Material de uso das Forças Armadas",
        timestamp: new Date(),
      },
    ],
  },
  {
    id: "3",
    title: "Prazo recursal",
    lastMessage: "O prazo recursal na Lei nº 14.133/2021...",
    date: "3 dias atrás",
    messages: [],
  },
];

const legalRefs = [
  "Art. 28 — Modalidades de licitação",
  "Art. 72 — Procedimentos auxiliares",
  "Art. 74 — Inexigibilidade",
  "Art. 75 — Dispensa",
  "Art. 140 — Recebimento do objeto",
];

export default function ChatPage() {
  const [conversations, setConversations] = useState(mockConversations);
  const [activeConv, setActiveConv] = useState(mockConversations[0]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || "");
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv.messages]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    const updated = {
      ...activeConv,
      messages: [...activeConv.messages, userMsg],
      lastMessage: input,
    };
    setActiveConv(updated);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setInput("");
    setIsTyping(true);

    let assistantContent = "";
    const assistantId = (Date.now() + 1).toString();

    const chatMessages = updated.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    streamChat({
      messages: chatMessages,
      usuarioId: userEmail,
      onDelta: (chunk) => {
        assistantContent += chunk;
        const botMsg: Message = {
          id: assistantId,
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        };
        const withBot = {
          ...updated,
          messages: [
            ...updated.messages,
            botMsg,
          ],
        };
        setActiveConv(withBot);
        setConversations((prev) => prev.map((c) => (c.id === withBot.id ? withBot : c)));
      },
      onDone: () => {
        setIsTyping(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsTyping(false);
      },
    });
  };

  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 -mt-2">
      {/* Conversations sidebar */}
      <div className="hidden w-72 shrink-0 flex-col rounded-xl border border-border bg-card md:flex">
        <div className="border-b border-border p-3">
          <Button
            variant="gold"
            size="sm"
            className="w-full"
            onClick={() => {
              const newConv: Conversation = {
                id: Date.now().toString(),
                title: "Nova conversa",
                lastMessage: "",
                date: "Agora",
                messages: [],
              };
              setConversations([newConv, ...conversations]);
              setActiveConv(newConv);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              className="pl-8 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredConvs.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-left transition-colors mb-0.5",
                activeConv.id === conv.id
                  ? "bg-accent/10 text-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <p className="text-xs truncate mt-0.5 opacity-60">{conv.lastMessage || "Sem mensagens"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" />
            <h2 className="font-semibold">{activeConv.title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {activeConv.messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-accent/30 mb-4" />
              <h3 className="text-lg font-semibold">Assistente Jurídico IA</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Faça perguntas sobre a Lei 14.133/2021, anexe editais em PDF ou peça análises de documentos.
              </p>
            </div>
          )}

          <AnimatePresence>
            {activeConv.messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  )}
                >
                  <div className="prose prose-sm max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="rounded-2xl bg-secondary px-4 py-3 rounded-bl-md">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <Input
                placeholder="Pergunte sobre a Lei 14.133/2021..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-10"
              />
            </div>
            <Button type="submit" variant="gold" size="icon" className="h-10 w-10 shrink-0" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Legal context sidebar */}
      <div className="hidden w-64 shrink-0 flex-col rounded-xl border border-border bg-card xl:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            Referências legais
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {legalRefs.map((ref) => (
            <div
              key={ref}
              className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary cursor-pointer transition-colors"
            >
              {ref}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-accent/5 border border-accent/10 p-3">
            <p className="text-xs font-medium text-accent flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Documentos anexados
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum documento anexado nesta conversa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
