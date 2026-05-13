import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Briefcase, Plus, ChevronRight, Clock, CheckCircle2, XCircle,
  MessageSquare, Send, Users, User, Calendar, DollarSign, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  budget_min: number;
  budget_max: number;
  deadline: string | null;
  requirements: string | null;
  status: string;
  selected_application_id: string | null;
  created_at: string;
}

interface Application {
  id: string;
  project_id: string;
  consultant_id: string;
  proposal: string;
  proposed_value: number;
  estimated_days: number;
  status: string;
  created_at: string;
  consultant?: { full_name: string | null; email: string | null };
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────
const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const CATEGORY_LABELS: Record<string, string> = {
  etp: "ETP", tr: "TR", dfd: "DFD",
  impugnacao: "Impugnação", pregao: "Pregão", dispensa: "Dispensa",
  auditoria: "Auditoria", gestao: "Gestão Contratual", consultoria: "Consultoria",
};

const CATEGORY_COLOR: Record<string, string> = {
  etp:        "bg-amber-400/15 text-amber-400 border-amber-400/30",
  tr:         "bg-blue-400/15 text-blue-400 border-blue-400/30",
  dfd:        "bg-indigo-400/15 text-indigo-400 border-indigo-400/30",
  impugnacao: "bg-red-400/15 text-red-400 border-red-400/30",
  pregao:     "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  dispensa:   "bg-orange-400/15 text-orange-400 border-orange-400/30",
  auditoria:  "bg-purple-400/15 text-purple-400 border-purple-400/30",
  gestao:     "bg-teal-400/15 text-teal-400 border-teal-400/30",
  consultoria:"bg-cyan-400/15 text-cyan-400 border-cyan-400/30",
};

const STATUS_LABEL: Record<string, string> = {
  open:        "Aberto",
  contracted:  "Contratado",
  in_progress: "Em andamento",
  delivered:   "Entregue",
  completed:   "Concluído",
  cancelled:   "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  open:        "bg-sky-400/15 text-sky-400 border-sky-400/30",
  contracted:  "bg-amber-400/15 text-amber-400 border-amber-400/30",
  in_progress: "bg-orange-400/15 text-orange-400 border-orange-400/30",
  delivered:   "bg-indigo-400/15 text-indigo-400 border-indigo-400/30",
  completed:   "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  cancelled:   "bg-red-400/15 text-red-400 border-red-400/30",
};

const APP_STATUS_LABEL: Record<string, string> = {
  pending:   "Em análise",
  accepted:  "Aceita",
  rejected:  "Recusada",
  withdrawn: "Retirada",
};

const APP_STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-400/15 text-amber-400 border-amber-400/30",
  accepted:  "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  rejected:  "bg-red-400/15 text-red-400 border-red-400/30",
  withdrawn: "bg-zinc-400/15 text-zinc-400 border-zinc-400/30",
};

// ── Main Component ──────────────────────────────────────────────
export default function MyProjectsPage() {
  const [projects, setProjects]       = useState<Project[]>([]);
  const [selected, setSelected]       = useState<Project | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [msgText, setMsgText]         = useState("");
  const [userId, setUserId]           = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetail, setLoadingDetail]     = useState(false);
  const [sendingMsg, setSendingMsg]   = useState(false);
  const [activeTab, setActiveTab]     = useState<"applications" | "messages">("applications");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ── Load projects ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("marketplace_projects")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      setProjects(data || []);
      setLoadingProjects(false);
    })();
  }, []);

  // ── Load detail when project selected ─────────────────────
  useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    setApplications([]);
    setMessages([]);
    setActiveTab("applications");

    (async () => {
      const [appsRes, msgsRes] = await Promise.all([
        supabase
          .from("project_applications")
          .select("*")
          .eq("project_id", selected.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("project_messages")
          .select("*")
          .eq("project_id", selected.id)
          .order("created_at", { ascending: true }),
      ]);

      const apps = appsRes.data || [];
      const consultantIds = [...new Set(apps.map(a => a.consultant_id))];

      let consultants: any[] = [];
      if (consultantIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", consultantIds);
        consultants = data || [];
      }

      const appsWithProfile = apps.map(a => ({
        ...a,
        consultant: consultants.find(c => c.id === a.consultant_id) ?? null,
      }));

      setApplications(appsWithProfile);
      setMessages(msgsRes.data || []);
      setLoadingDetail(false);
    })();
  }, [selected]);

  // ── Scroll messages to bottom ──────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Accept application ─────────────────────────────────────
  const handleAccept = async (app: Application) => {
    const { error } = await supabase
      .from("project_applications")
      .update({ status: "accepted" })
      .eq("id", app.id);
    if (error) { toast({ title: "Erro ao aceitar proposta", variant: "destructive" }); return; }

    await supabase
      .from("marketplace_projects")
      .update({ status: "contracted", selected_application_id: app.id })
      .eq("id", selected!.id);

    await supabase
      .from("project_applications")
      .update({ status: "rejected" })
      .eq("project_id", selected!.id)
      .neq("id", app.id)
      .eq("status", "pending");

    toast({ title: "Proposta aceita! Projeto contratado." });
    setApplications(prev =>
      prev.map(a => ({
        ...a,
        status: a.id === app.id ? "accepted"
               : a.status === "pending" ? "rejected"
               : a.status,
      }))
    );
    setSelected(prev => prev ? { ...prev, status: "contracted", selected_application_id: app.id } : null);
    setProjects(prev => prev.map(p => p.id === selected!.id
      ? { ...p, status: "contracted", selected_application_id: app.id }
      : p
    ));
  };

  // ── Reject application ─────────────────────────────────────
  const handleReject = async (app: Application) => {
    const { error } = await supabase
      .from("project_applications")
      .update({ status: "rejected" })
      .eq("id", app.id);
    if (error) { toast({ title: "Erro ao recusar proposta", variant: "destructive" }); return; }
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "rejected" } : a));
    toast({ title: "Proposta recusada." });
  };

  // ── Send message ───────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!msgText.trim() || !selected) return;
    setSendingMsg(true);
    const { data, error } = await supabase
      .from("project_messages")
      .insert({ project_id: selected.id, sender_id: userId, content: msgText.trim() })
      .select()
      .single();
    setSendingMsg(false);
    if (error) { toast({ title: "Erro ao enviar mensagem", variant: "destructive" }); return; }
    setMessages(prev => [...prev, data]);
    setMsgText("");
  };

  // ── Empty state ────────────────────────────────────────────
  if (!loadingProjects && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
          <Briefcase className="h-8 w-8 text-violet-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Nenhum projeto publicado</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Publique seu primeiro projeto para receber propostas de consultores verificados.
          </p>
        </div>
        <Link to="/dashboard/publicar-projeto">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Publicar Projeto
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-7rem)] overflow-hidden -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {/* ── Project list ──────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r transition-all duration-300 overflow-hidden",
          selected ? "w-0 md:w-80 lg:w-96 hidden md:flex" : "w-full md:w-80 lg:w-96",
        )}
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
          <div>
            <h2 className="text-sm font-semibold">Meus Projetos</h2>
            <p className="text-xs text-muted-foreground">{projects.length} projeto{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <Link to="/dashboard/publicar-projeto">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </Link>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "hsl(var(--border))" }}>
          {loadingProjects ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Carregando…</div>
          ) : (
            projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "w-full text-left px-4 py-3.5 transition-colors space-y-2 hover:bg-secondary/50",
                  selected?.id === p.id && "bg-secondary"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border", CATEGORY_COLOR[p.category] || "bg-zinc-400/15 text-zinc-400")}>
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                  <span className={cn("inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLOR[p.status])}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                  {p.budget_max > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      até {fmtMoney(p.budget_max)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{fmtDate(p.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
              <button
                onClick={() => setSelected(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-secondary transition-colors mt-0.5"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="text-sm font-semibold truncate">{selected.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className={cn("inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border", CATEGORY_COLOR[selected.category] || "bg-zinc-400/15 text-zinc-400")}>
                    {CATEGORY_LABELS[selected.category] || selected.category}
                  </span>
                  <span className={cn("inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLOR[selected.status])}>
                    {STATUS_LABEL[selected.status] || selected.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {(selected.budget_min > 0 || selected.budget_max > 0) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {selected.budget_min > 0 && selected.budget_max > 0
                        ? `${fmtMoney(selected.budget_min)} – ${fmtMoney(selected.budget_max)}`
                        : selected.budget_max > 0 ? `até ${fmtMoney(selected.budget_max)}`
                        : fmtMoney(selected.budget_min)}
                    </span>
                  )}
                  {selected.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Entrega: {new Date(selected.deadline).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {applications.length} proposta{applications.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0 px-5" style={{ borderColor: "hsl(var(--border))" }}>
              {(["applications", "messages"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 mr-4 transition-colors",
                    activeTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "applications" ? (
                    <><Users className="h-3.5 w-3.5" /> Propostas ({applications.length})</>
                  ) : (
                    <><MessageSquare className="h-3.5 w-3.5" /> Mensagens ({messages.length})</>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {loadingDetail ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando…</div>
              ) : activeTab === "applications" ? (
                <div className="p-5 space-y-4">
                  {/* Project description */}
                  <div className="rounded-lg border bg-secondary/30 p-4 space-y-2" style={{ borderColor: "hsl(var(--border))" }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</p>
                    <p className="text-sm leading-relaxed">{selected.description}</p>
                    {selected.requirements && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-1">Requisitos</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{selected.requirements}</p>
                      </>
                    )}
                  </div>

                  {applications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma proposta ainda</p>
                      <p className="text-xs mt-1">Consultores verificados irão enviar propostas em breve</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Propostas recebidas
                      </p>
                      {applications.map(app => (
                        <div
                          key={app.id}
                          className={cn(
                            "rounded-xl border p-4 space-y-3",
                            app.status === "accepted" && "border-emerald-500/40 bg-emerald-500/5"
                          )}
                          style={{ borderColor: app.status === "accepted" ? undefined : "hsl(var(--border))" }}
                        >
                          {/* Consultant header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                                {(app.consultant?.full_name || app.consultant?.email || "C")
                                  .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {app.consultant?.full_name || "Consultor"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtDate(app.created_at)} · {app.estimated_days} dias estimados
                                </p>
                              </div>
                            </div>
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", APP_STATUS_COLOR[app.status])}>
                              {APP_STATUS_LABEL[app.status]}
                            </span>
                          </div>

                          {/* Proposal text */}
                          <p className="text-sm text-muted-foreground leading-relaxed">{app.proposal}</p>

                          {/* Value breakdown */}
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Valor proposto</p>
                              <p className="font-semibold">{fmtMoney(app.proposed_value)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Taxa plataforma (20%)</p>
                              <p className="font-semibold text-muted-foreground">
                                {fmtMoney(Math.round(app.proposed_value * 0.2))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Consultor recebe</p>
                              <p className="font-semibold text-emerald-400">
                                {fmtMoney(Math.round(app.proposed_value * 0.8))}
                              </p>
                            </div>
                          </div>

                          {/* Actions — only for pending apps on open projects */}
                          {app.status === "pending" && selected.status === "open" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                                onClick={() => handleAccept(app)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar proposta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                                onClick={() => handleReject(app)}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Recusar
                              </Button>
                            </div>
                          )}

                          {app.status === "accepted" && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Proposta aceita — projeto contratado
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Messages tab */
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma mensagem ainda</p>
                        <p className="text-xs mt-1">Inicie a conversa com o(s) consultor(es)</p>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMe = msg.sender_id === userId;
                        return (
                          <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm",
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-secondary text-foreground rounded-bl-sm"
                              )}
                            >
                              <p className="leading-relaxed">{msg.content}</p>
                              <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message input */}
                  <div className="border-t p-4 flex gap-2 shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
                    <Textarea
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      placeholder="Escreva uma mensagem…"
                      className="min-h-[40px] max-h-[120px] resize-none text-sm"
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!msgText.trim() || sendingMsg}
                      onClick={handleSendMessage}
                      className="h-10 w-10 p-0 shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty right panel when no project selected on desktop */}
      {!selected && (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <Briefcase className="h-10 w-10 mx-auto opacity-20" />
            <p className="text-sm">Selecione um projeto para ver os detalhes</p>
          </div>
        </div>
      )}
    </div>
  );
}
