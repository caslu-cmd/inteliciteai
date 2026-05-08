import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { MessageSquareText, Send, Bot, User, Sparkles, FileText, Scale, HelpCircle, BookOpen } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    content: "Olá! Sou o assistente jurídico especializado em licitações. Posso ajudar com análise de editais, dúvidas sobre a **Lei 14.133/2021**, requisitos de habilitação e muito mais.\n\nComo posso ajudá-lo hoje?",
    timestamp: "10:00",
  },
];

const quickActions = [
  { icon: FileText,   label: "Analisar cláusula",     prompt: "Analise a cláusula de habilitação técnica do último edital carregado" },
  { icon: Scale,      label: "Verificar legalidade",   prompt: "Esta exigência de ISO 27001 obrigatória é legal segundo a Lei 14.133/2021?" },
  { icon: HelpCircle, label: "Redigir esclarecimento", prompt: "Redija um pedido de esclarecimento sobre o prazo de entrega de 60 dias" },
  { icon: BookOpen,   label: "Consultar lei",          prompt: "Quais são os requisitos de qualificação técnica segundo o Art. 67 da Lei 14.133/2021?" },
];

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("iso") || lower.includes("27001")) {
    return "A exigência de certificação ISO 27001 como requisito obrigatório de habilitação técnica pode ser considerada **restritiva à competitividade**, conforme o **Art. 67, §1º da Lei 14.133/2021**, que determina que as exigências de qualificação técnica devem se limitar ao necessário para garantir a execução do contrato.\n\nSe a certificação não for diretamente relacionada ao objeto, recomendo a **impugnação** com base neste artigo. Posso gerar a minuta automaticamente.";
  }
  if (lower.includes("prazo") || lower.includes("entrega")) {
    return "O prazo de entrega de 60 dias pode ser considerado **exíguo** dependendo da complexidade do objeto. O **Art. 55, §1º da Lei 14.133/2021** estabelece que os prazos devem ser compatíveis com a natureza e complexidade do objeto.\n\nRecomendo solicitar esclarecimento ao órgão licitante sobre a viabilidade deste prazo. Posso redigir o pedido para você.";
  }
  if (lower.includes("art. 67") || lower.includes("qualificação técnica")) {
    return "O **Art. 67 da Lei 14.133/2021** trata da qualificação técnica e estabelece:\n\n1. Registro ou inscrição no conselho profissional competente\n2. Comprovação de aptidão para desempenho de atividade pertinente e compatível\n3. Indicação das instalações, aparelhamento e equipe técnica\n4. Prova de atendimento de requisitos previstos em lei especial\n\nO **§1º** limita as exigências ao estritamente necessário para garantir a execução contratual.";
  }
  return "Entendi sua dúvida. Com base na **Lei 14.133/2021** e nas melhores práticas em licitações públicas, posso fazer uma análise detalhada.\n\nPoderia fornecer mais detalhes sobre o edital em questão? Assim consigo dar uma orientação mais precisa e, se necessário, gerar documentos como impugnação ou pedido de esclarecimento.";
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = (text?: string) => {
    const content = text || input;
    if (!content.trim()) return;
    const userMsg: Message = { id: messages.length + 1, role: "user", content, timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      const aiMsg: Message = { id: messages.length + 2, role: "assistant", content: getSimulatedResponse(content), timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <LicitanteLayout>
      <div className="h-[calc(100vh)] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-base text-foreground flex items-center gap-1.5">
              Assistente IA <Sparkles className="w-4 h-4 text-primary" />
            </h1>
            <p className="text-xs text-muted-foreground">Especialista em licitações · Lei 14.133/2021</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="px-6 py-2 flex gap-2 overflow-x-auto">
          {quickActions.map((action) => (
            <button key={action.label} onClick={() => sendMessage(action.prompt)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors whitespace-nowrap flex-shrink-0">
              <action.icon className="w-3 h-3" />{action.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border bg-card">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Pergunte sobre licitações, editais, Lei 14.133/2021..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-[120px]"
            />
            <Button size="icon" className="h-11 w-11 rounded-xl flex-shrink-0" onClick={() => sendMessage()} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
