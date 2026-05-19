import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquareText, Send, Bot, User, Sparkles,
  FileText, Scale, HelpCircle, BookOpen, AlertTriangle,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const INITIAL: Message[] = [
  {
    role: "assistant",
    content: "Olá! Sou o assistente jurídico especializado em licitações, com conhecimento profundo da **Lei 14.133/2021**.\n\nPosso analisar editais, redigir impugnações, verificar requisitos de habilitação, orientar sobre prazos e muito mais.\n\nComo posso ajudá-lo hoje?",
    timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  },
];

const QUICK_ACTIONS = [
  { icon: FileText,   label: "Analisar cláusula",     prompt: "Analise se uma exigência de ISO 27001 obrigatória em edital de TI é legal segundo a Lei 14.133/2021" },
  { icon: Scale,      label: "Verificar legalidade",   prompt: "Uma exigência de visita técnica obrigatória é legal segundo a Nova Lei de Licitações?" },
  { icon: HelpCircle, label: "Redigir esclarecimento", prompt: "Redija um pedido de esclarecimento sobre prazo de entrega de 30 dias que parece exíguo" },
  { icon: BookOpen,   label: "Consultar Art. 67",      prompt: "Quais são os requisitos de qualificação técnica segundo o Art. 67 da Lei 14.133/2021?" },
];

function ts() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isTyping) return;

    const userMsg: Message = { role: "user", content, timestamp: ts() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/licitante-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply, timestamp: ts() }]);
    } catch (err: any) {
      setError(err.message || "Falha ao chamar o assistente");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <LicitanteLayout>
      <div className="h-[calc(100vh-0px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card flex-shrink-0">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-base text-foreground flex items-center gap-1.5">
              Assistente IA <Sparkles className="w-4 h-4 text-primary" />
            </h1>
            <p className="text-xs text-muted-foreground">Especialista em licitações · Lei 14.133/2021 · Intelicite IA</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-md"
                  : "bg-card border border-border text-card-foreground rounded-tl-md shadow-card"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.timestamp}
                </span>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-card">
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick actions */}
        <div className="px-6 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} onClick={() => sendMessage(a.prompt)} disabled={isTyping}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-40">
              <a.icon className="w-3 h-3" />{a.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border bg-card flex-shrink-0">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Pergunte sobre licitações, editais, Lei 14.133/2021..."
              rows={1}
              disabled={isTyping}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[120px] disabled:opacity-50"
            />
            <Button size="icon" className="h-11 w-11 rounded-xl flex-shrink-0" onClick={() => sendMessage()} disabled={!input.trim() || isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
            Respostas geradas por Intelicite IA · sempre verifique com profissional jurídico habilitado
          </p>
        </div>
      </div>
    </LicitanteLayout>
  );
}
