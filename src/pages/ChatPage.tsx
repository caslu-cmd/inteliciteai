import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, Plus, Search, Bot, User, FileText,
  Trash2, Download, BookOpen, Loader2, MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/streamChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  date: string;
  messages: Message[];
}

const legalRefs = [
  "Art. 28 — Modalidades de licitação",
  "Art. 72 — Procedimentos auxiliares",
  "Art. 74 — Inexigibilidade",
  "Art. 75 — Dispensa",
  "Art. 140 — Recebimento do objeto",
];

const blankConv = (): Conversation => ({
  id: "new-" + Date.now(),
  title: "Nova conversa",
  lastMessage: "",
  date: "Agora",
  messages: [],
});

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return `${diffDays} dias atrás`;
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation>(blankConv);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv.messages]);

  const loadConversations = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("chat_conversations")
        .select("id, title, messages, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const loaded: Conversation[] = data.map((row: any) => {
          const msgs: Message[] = (row.messages || []).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          const last = msgs[msgs.length - 1];
          return {
            id: row.id,
            title: row.title,
            lastMessage: last?.content?.slice(0, 60) || "",
            date: fmtDate(row.updated_at),
            messages: msgs,
          };
        });
        setConversations(loaded);
        setActiveConv(loaded[0]);
      } else {
        const first = blankConv();
        setConversations([first]);
        setActiveConv(first);
      }
    } catch {
      const first = blankConv();
      setConversations([first]);
      setActiveConv(first);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveConversation = useCallback(async (conv: Conversation) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const messages = conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

      if (conv.id.startsWith("new-")) {
        const { data } = await supabase
          .from("chat_conversations")
          .insert({ user_id: user.id, title: conv.title, messages })
          .select("id")
          .single();
        if (data) {
          const updated = { ...conv, id: data.id };
          setConversations((prev) => prev.map((c) => c.id === conv.id ? updated : c));
          setActiveConv((prev) => prev.id === conv.id ? updated : prev);
        }
      } else {
        await supabase
          .from("chat_conversations")
          .update({ title: conv.title, messages })
          .eq("id", conv.id);
      }
    } catch {
      // silent — conversation is still in memory
    }
  }, []);

  const deleteConversation = async (convId: string) => {
    if (!convId.startsWith("new-")) {
      await supabase.from("chat_conversations").delete().eq("id", convId);
    }
    const remaining = conversations.filter((c) => c.id !== convId);
    if (remaining.length === 0) {
      const fresh = blankConv();
      setConversations([fresh]);
      setActiveConv(fresh);
    } else {
      setConversations(remaining);
      if (activeConv.id === convId) setActiveConv(remaining[0]);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const isFirstMessage = activeConv.messages.length === 0;
    const newTitle = isFirstMessage
      ? input.trim().slice(0, 50) + (input.length > 50 ? "…" : "")
      : activeConv.title;

    const updated: Conversation = {
      ...activeConv,
      title: newTitle,
      messages: [...activeConv.messages, userMsg],
      lastMessage: input,
    };

    setActiveConv(updated);
    setConversations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setInput("");
    setIsTyping(true);

    let assistantContent = "";
    const assistantId = (Date.now() + 1).toString();

    const chatMessages = updated.messages.map((m) => ({ role: m.role, content: m.content }));

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
        const withBot: Conversation = {
          ...updated,
          messages: [...updated.messages, botMsg],
        };
        setActiveConv(withBot);
        setConversations((prev) => prev.map((c) => c.id === withBot.id ? withBot : c));
      },
      onDone: () => {
        setIsTyping(false);
        setActiveConv((current) => {
          saveConversation(current);
          return current;
        });
      },
      onError: (error) => {
        toast.error(error);
        setIsTyping(false);
      },
    });
  };

  const handleNewConversation = () => {
    const newConv = blankConv();
    setConversations([newConv, ...conversations]);
    setActiveConv(newConv);
  };

  const filteredConvs = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 -mt-2">
      {/* Conversations sidebar */}
      <div className="hidden w-72 shrink-0 flex-col rounded-xl border border-border bg-card md:flex">
        <div className="border-b border-border p-3">
          <Button variant="gold" size="sm" className="w-full" onClick={handleNewConversation}>
            <Plus className="mr-2 h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar conversas..." className="pl-8 h-8 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConvs.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-left transition-colors mb-0.5 group",
                activeConv.id === conv.id ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-medium truncate flex-1">{conv.title}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs truncate mt-0.5 opacity-60">{conv.lastMessage || "Sem mensagens"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0" title="Conversas">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[88vw] sm:w-80">
                <div className="flex flex-col h-full">
                  <div className="border-b border-border p-3">
                    <Button variant="gold" size="sm" className="w-full" onClick={handleNewConversation}>
                      <Plus className="mr-2 h-4 w-4" /> Nova conversa
                    </Button>
                  </div>
                  <div className="p-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Buscar conversas..." className="pl-8 h-8 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-2">
                    {filteredConvs.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setActiveConv(conv)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2.5 text-left transition-colors mb-0.5",
                          activeConv.id === conv.id ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-xs truncate mt-0.5 opacity-60">{conv.lastMessage || "Sem mensagens"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Bot className="h-5 w-5 text-accent shrink-0" />
            <h2 className="font-semibold truncate">{activeConv.title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Excluir conversa" onClick={() => deleteConversation(activeConv.id)}>
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
                Faça perguntas sobre a Lei 14.133/2021, solicite análises ou peça ajuda para elaborar documentos.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["Qual a modalidade para serviços de TI?", "Explique a dispensa de licitação", "Como elaborar um ETP?"].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/40 hover:bg-accent/5 transition-colors text-muted-foreground">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {activeConv.messages.map((msg, idx) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03, duration: 0.3 }}
                className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"
                )}>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
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

        {/* Input */}
        <div className="border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-end gap-2">
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
            <Button type="submit" variant="gold" size="icon" className="h-10 w-10 shrink-0" disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Legal sidebar */}
      <div className="hidden w-64 shrink-0 flex-col rounded-xl border border-border bg-card xl:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            Referências legais
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {legalRefs.map((ref) => (
            <button key={ref} onClick={() => setInput(`Explique o ${ref.split("—")[0].trim()}`)}
              className="w-full text-left rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary cursor-pointer transition-colors">
              {ref}
            </button>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-accent/5 border border-accent/10 p-3">
            <p className="text-xs font-medium text-accent flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Histórico salvo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {conversations.filter(c => !c.id.startsWith("new-")).length} conversa(s) salva(s) no Supabase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
