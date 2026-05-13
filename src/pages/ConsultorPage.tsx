import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, LogOut, Upload, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, Shield, FileText, User, Briefcase, Camera, Loader2,
  RefreshCw, Star, Award, MapPin, Phone, Linkedin, Search, Filter,
  LayoutGrid, ClipboardList, MessageSquare, BadgeCheck, Send,
  DollarSign, Calendar, Users, Package, CheckCheck, X, ChevronDown,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Anti-fraud helpers ─────────────────────────────────────────
function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (s % 11); if (d1 >= 10) d1 = 0;
  if (parseInt(cpf[9]) !== d1) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (s % 11); if (d2 >= 10) d2 = 0;
  return parseInt(cpf[10]) === d2;
}
function formatCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function formatPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11).replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
async function calcRiskScore(data: any, userId: string) {
  const flags: string[] = []; let score = 0;
  if (!validateCPF(data.cpf)) { score += 50; flags.push("CPF inválido (algoritmo)"); }
  const cpfClean = data.cpf.replace(/\D/g, "");
  const { data: dup } = await (supabase.from("consultant_verifications" as any).select("id").eq("cpf", cpfClean).neq("user_id", userId).maybeSingle());
  if (dup) { score += 60; flags.push("CPF já cadastrado por outro usuário"); }
  if (!data.doc_selfie) { score += 20; flags.push("Selfie não enviada"); }
  if (!data.doc_identity) { score += 20; flags.push("Documento de identidade não enviado"); }
  const licensed = ["advogado", "contador", "engenheiro", "economista"];
  if (licensed.includes(data.professional_type) && !data.registration_number) { score += 25; flags.push("Número de registro profissional obrigatório"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.created_at) { const ageH = (Date.now() - new Date(user.created_at).getTime()) / 3600000; if (ageH < 24) { score += 20; flags.push("Conta criada há menos de 24 horas"); } }
  const { data: prev } = await (supabase.from("consultant_verifications" as any).select("status").eq("user_id", userId).eq("status", "rejected").maybeSingle());
  if (prev) { score += 30; flags.push("Submissão anterior rejeitada"); }
  return { score: Math.min(score, 100), flags };
}

// ── Constants ──────────────────────────────────────────────────
const PROF_TYPES = [
  { id: "advogado", label: "Advogado(a)", reg: "OAB" },
  { id: "contador", label: "Contador(a)", reg: "CRC" },
  { id: "administrador", label: "Administrador(a)", reg: "CRA" },
  { id: "engenheiro", label: "Engenheiro(a)", reg: "CREA" },
  { id: "economista", label: "Economista", reg: "CORECON" },
  { id: "outro", label: "Outro", reg: "" },
];
const SPECIALTIES = ["Lei 14.133/2021","Pregão Eletrônico","Dispensa de Licitação","Contratos Administrativos","Impugnações e Recursos","Compliance","TI e Softwares","Obras e Serviços de Engenharia","Saúde","Educação","Auditoria","Gestão de Contratos"];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const CATEGORIES: Record<string, { label: string; color: string }> = {
  etp:          { label: "ETP",              color: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
  tr:           { label: "TR",               color: "bg-blue-400/15 text-blue-400 border-blue-400/30" },
  dfd:          { label: "DFD",              color: "bg-indigo-400/15 text-indigo-400 border-indigo-400/30" },
  impugnacao:   { label: "Impugnação",       color: "bg-red-400/15 text-red-400 border-red-400/30" },
  pregao:       { label: "Pregão",           color: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
  dispensa:     { label: "Dispensa",         color: "bg-orange-400/15 text-orange-400 border-orange-400/30" },
  auditoria:    { label: "Auditoria",        color: "bg-purple-400/15 text-purple-400 border-purple-400/30" },
  gestao:       { label: "Gestão Contratual",color: "bg-teal-400/15 text-teal-400 border-teal-400/30" },
  consultoria:  { label: "Consultoria Geral",color: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" },
};

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type VerifStatus = "pending" | "in_review" | "approved" | "rejected" | "flagged";
type View = "marketplace" | "candidaturas" | "contratos" | "perfil";

// ── Marketplace Dashboard ──────────────────────────────────────
function ConsultorDashboard({ verification, userId, onLogout }: { verification: any; userId: string; onLogout: () => void }) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("marketplace");
  const [projects, setProjects] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [applyModal, setApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({ proposal: "", value: "", days: "7" });
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const profType = PROF_TYPES.find(p => p.id === verification.professional_type);
  const initials = (verification.full_name || "C").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    const { data } = await (supabase.from("marketplace_projects" as any).select("*, profiles!client_id(full_name, organization)").eq("status", "open").order("created_at", { ascending: false }));
    setProjects(data || []);
    setLoadingProjects(false);
  }, []);

  const loadApplications = useCallback(async () => {
    const { data } = await (supabase.from("project_applications" as any).select("*, marketplace_projects(*)").eq("consultant_id", userId).order("created_at", { ascending: false }));
    setApplications(data || []);
  }, [userId]);

  const loadContracts = useCallback(async () => {
    const { data } = await (supabase.from("project_applications" as any).select("*, marketplace_projects(*)").eq("consultant_id", userId).eq("status", "accepted").order("updated_at", { ascending: false }));
    setContracts(data || []);
  }, [userId]);

  useEffect(() => { loadProjects(); loadApplications(); loadContracts(); }, [loadProjects, loadApplications, loadContracts]);

  const loadMessages = useCallback(async (projectId: string) => {
    const { data } = await (supabase.from("project_messages" as any).select("*, profiles!sender_id(full_name)").eq("project_id", projectId).order("created_at"));
    setMessages(data || []);
  }, []);

  const handleApply = async () => {
    if (!selectedProject || !applyForm.proposal.trim() || !applyForm.value) return;
    const valueCents = Math.round(parseFloat(applyForm.value.replace(/\./g, "").replace(",", ".")) * 100);
    if (!valueCents) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }
    setApplying(true);
    const { error } = await (supabase.from("project_applications" as any).insert({
      project_id: selectedProject.id, consultant_id: userId,
      proposal: applyForm.proposal, proposed_value: valueCents,
      estimated_days: parseInt(applyForm.days) || 7,
    }));
    if (error) {
      toast({ title: error.code === "23505" ? "Você já se candidatou a este projeto" : "Erro ao candidatar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Candidatura enviada com sucesso!" });
      setApplyModal(false);
      setApplyForm({ proposal: "", value: "", days: "7" });
      loadApplications();
    }
    setApplying(false);
  };

  const handleSendMessage = async (projectId: string) => {
    if (!msgInput.trim()) return;
    setSendingMsg(true);
    const { error } = await (supabase.from("project_messages" as any).insert({ project_id: projectId, sender_id: userId, content: msgInput.trim() }));
    if (!error) { setMsgInput(""); loadMessages(projectId); }
    setSendingMsg(false);
  };

  const alreadyApplied = (projectId: string) => applications.some(a => a.project_id === projectId);

  const filteredProjects = projects.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const NAV = [
    { id: "marketplace",   label: "Marketplace",       icon: LayoutGrid,    badge: null },
    { id: "candidaturas",  label: "Minhas Candidaturas",icon: ClipboardList, badge: applications.filter(a => a.status === "pending").length || null },
    { id: "contratos",     label: "Meus Contratos",    icon: CheckCheck,    badge: contracts.length || null },
    { id: "perfil",        label: "Meu Perfil",        icon: User,          badge: null },
  ] as const;

  return (
    <div className="min-h-screen flex text-white" style={{ background: "hsl(223 27% 7%)" }}>
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#080D14]/80 sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-[#080D14]" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}>Intelicite</p>
            <p className="text-[10px] text-emerald-400 font-semibold">Consultor</p>
          </div>
        </div>

        {/* Profile mini */}
        <div className="px-4 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-sm font-bold text-emerald-400">{initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{verification.full_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <BadgeCheck className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">Verificado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => setView(item.id as View)}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  active ? "bg-emerald-400/15 text-emerald-400" : "text-white/40 hover:text-white hover:bg-white/[0.05]")}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400">{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.06]">
          <button onClick={onLogout} className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors w-full px-3 py-2">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        {/* ── MARKETPLACE ── */}
        {view === "marketplace" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">Marketplace de Projetos</h1>
                <p className="text-sm text-white/40 mt-0.5">{filteredProjects.length} projeto{filteredProjects.length !== 1 ? "s" : ""} disponíve{filteredProjects.length !== 1 ? "is" : "l"}</p>
              </div>
            </div>

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projetos..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/40" />
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 focus:outline-none">
                <option value="">Todas as categorias</option>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k} className="bg-[#080D14]">{v.label}</option>)}
              </select>
            </div>

            {/* Projects grid */}
            {loadingProjects ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Package className="h-12 w-12 text-white/10" />
                <p className="text-white/40 text-sm">{search || catFilter ? "Nenhum projeto encontrado com esses filtros" : "Nenhum projeto publicado ainda"}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProjects.map(project => {
                  const cat = CATEGORIES[project.category] || { label: project.category, color: "bg-white/10 text-white/40 border-white/10" };
                  const applied = alreadyApplied(project.id);
                  return (
                    <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col gap-4 hover:border-emerald-400/20 hover:bg-white/[0.04] transition-all cursor-pointer"
                      onClick={() => { setSelectedProject(project); loadMessages(project.id); }}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cat.color)}>{cat.label}</span>
                        {applied && <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Candidatado</span>}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-snug">{project.title}</h3>
                        <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{project.description}</p>
                      </div>
                      <div className="space-y-1.5 mt-auto">
                        <div className="flex items-center justify-between text-xs text-white/40">
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{fmtMoney(project.budget_min)} – {fmtMoney(project.budget_max)}</span>
                          {project.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(project.deadline).toLocaleDateString("pt-BR")}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/25">{project.profiles?.organization || "Órgão público"}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CANDIDATURAS ── */}
        {view === "candidaturas" && (
          <div className="p-6 space-y-5">
            <h1 className="text-xl font-bold">Minhas Candidaturas</h1>
            {applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <ClipboardList className="h-10 w-10 text-white/10" />
                <p className="text-white/40 text-sm">Você ainda não se candidatou a nenhum projeto</p>
                <button onClick={() => setView("marketplace")} className="text-xs text-emerald-400 hover:underline mt-1">Ver projetos disponíveis</button>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => {
                  const project = app.marketplace_projects;
                  const cat = project ? (CATEGORIES[project.category] || { label: project.category, color: "bg-white/10 text-white/40 border-white/10" }) : null;
                  const statusCfg: Record<string, { label: string; cls: string }> = {
                    pending:   { label: "Em análise",  cls: "text-amber-400 bg-amber-400/10" },
                    accepted:  { label: "Aceita",      cls: "text-emerald-400 bg-emerald-400/10" },
                    rejected:  { label: "Recusada",    cls: "text-red-400 bg-red-400/10" },
                    withdrawn: { label: "Retirada",    cls: "text-white/30 bg-white/5" },
                  };
                  const sc = statusCfg[app.status] || statusCfg.pending;
                  return (
                    <div key={app.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 flex items-start gap-4">
                      {cat && <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 mt-0.5", cat.color)}>{cat.label}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{project?.title || "Projeto removido"}</p>
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{app.proposal}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                          <span>Proposta: <span className="text-white/60 font-mono">{fmtMoney(app.proposed_value)}</span></span>
                          <span>{app.estimated_days} dias</span>
                          <span>{new Date(app.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0", sc.cls)}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CONTRATOS ── */}
        {view === "contratos" && (
          <div className="p-6 space-y-5">
            <h1 className="text-xl font-bold">Meus Contratos</h1>
            {contracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <CheckCheck className="h-10 w-10 text-white/10" />
                <p className="text-white/40 text-sm">Nenhum contrato ativo ainda</p>
                <p className="text-xs text-white/25 max-w-xs">Quando o cliente aceitar sua proposta, o projeto aparecerá aqui e você poderá negociar e entregar o trabalho.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map(contract => {
                  const project = contract.marketplace_projects;
                  const platformFee = Math.round(contract.proposed_value * (project?.platform_fee_pct || 20) / 100);
                  const consultorAmount = contract.proposed_value - platformFee;
                  return (
                    <div key={contract.id} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{project?.title}</p>
                          <p className="text-xs text-white/40 mt-0.5">{project?.profiles?.organization || "Cliente"}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-400 shrink-0">{project?.status === "completed" ? "Concluído" : "Em andamento"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {[
                          { label: "Valor do contrato", value: fmtMoney(contract.proposed_value) },
                          { label: "Taxa plataforma (20%)", value: fmtMoney(platformFee) },
                          { label: "Seu recebível", value: fmtMoney(consultorAmount), highlight: true },
                        ].map(({ label, value, highlight }) => (
                          <div key={label} className={cn("rounded-lg p-3", highlight ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-white/[0.03]")}>
                            <p className={cn("text-sm font-bold font-mono", highlight ? "text-emerald-400" : "text-white/80")}>{value}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-3 flex items-start gap-2">
                        <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-white/50">
                          O pagamento é liberado apenas após a confirmação de entrega pelo cliente.
                          A plataforma retém 20% como taxa de intermediação.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PERFIL ── */}
        {view === "perfil" && (
          <div className="p-6 max-w-2xl space-y-6">
            <h1 className="text-xl font-bold">Meu Perfil</h1>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/20 text-2xl font-bold text-emerald-400">{initials}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg">{verification.full_name}</h2>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 text-[10px] font-semibold"><BadgeCheck className="h-3 w-3" /> Verificado</span>
                  </div>
                  <p className="text-white/40 text-sm">{profType?.label || verification.professional_type}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-white/30">
                    {verification.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{verification.phone}</span>}
                    {verification.registration_state && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{verification.registration_state}</span>}
                    {verification.years_experience && <span className="flex items-center gap-1"><Award className="h-3 w-3" />{verification.years_experience} anos de experiência</span>}
                  </div>
                </div>
              </div>
              {verification.bio && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Bio</p>
                  <p className="text-sm text-white/60 leading-relaxed">{verification.bio}</p>
                </div>
              )}
              {verification.specialties?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Especialidades</p>
                  <div className="flex flex-wrap gap-2">
                    {verification.specialties.map((s: string) => (
                      <span key={s} className="px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {verification.linkedin_url && (
                <a href={`https://${verification.linkedin_url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-cyan-400 hover:underline">
                  <Linkedin className="h-3.5 w-3.5" /> {verification.linkedin_url}
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Project detail panel ── */}
      <AnimatePresence>
        {selectedProject && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => { setSelectedProject(null); setApplyModal(false); }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0B1120] border-l border-white/[0.08] z-50 flex flex-col overflow-hidden">

              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                  {(() => { const cat = CATEGORIES[selectedProject.category]; return cat ? <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cat.color)}>{cat.label}</span> : null; })()}
                  <span className="text-xs text-white/30">#{selectedProject.id.slice(0, 8)}</span>
                </div>
                <button onClick={() => { setSelectedProject(null); setApplyModal(false); }} className="text-white/30 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <h2 className="text-lg font-bold leading-snug">{selectedProject.title}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Orçamento", value: `${fmtMoney(selectedProject.budget_min)} – ${fmtMoney(selectedProject.budget_max)}`, icon: DollarSign },
                    { label: "Prazo", value: selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString("pt-BR") : "Não informado", icon: Calendar },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                      <Icon className="h-3.5 w-3.5 text-white/30 mb-1" />
                      <p className="text-sm font-semibold">{value}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Descrição</p>
                  <p className="text-sm text-white/60 leading-relaxed">{selectedProject.description}</p>
                </div>
                {selectedProject.requirements && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Requisitos</p>
                    <p className="text-sm text-white/60 leading-relaxed">{selectedProject.requirements}</p>
                  </div>
                )}

                {/* Messages */}
                {alreadyApplied(selectedProject.id) && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Mensagens</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                      {messages.length === 0 ? (
                        <p className="text-xs text-white/20 italic">Nenhuma mensagem ainda</p>
                      ) : messages.map(msg => (
                        <div key={msg.id} className={cn("rounded-lg px-3 py-2 text-xs max-w-[90%]", msg.sender_id === userId ? "ml-auto bg-emerald-400/15 text-emerald-300" : "bg-white/[0.05] text-white/60")}>
                          <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.sender_id === userId ? "Você" : (msg.profiles?.full_name || "Cliente")}</p>
                          {msg.content}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(selectedProject.id); } }}
                        placeholder="Enviar mensagem..."
                        className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400/40" />
                      <button onClick={() => handleSendMessage(selectedProject.id)} disabled={sendingMsg || !msgInput.trim()}
                        className="px-3 py-2 rounded-lg bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30 transition-colors disabled:opacity-40">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Apply form */}
                {!alreadyApplied(selectedProject.id) && applyModal && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 space-y-3">
                    <p className="text-sm font-semibold text-emerald-400">Sua proposta</p>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Apresentação e abordagem *</label>
                      <textarea rows={4} value={applyForm.proposal} onChange={e => setApplyForm(f => ({ ...f, proposal: e.target.value }))}
                        placeholder="Descreva sua experiência, como abordaria o projeto e por que é o consultor ideal..."
                        className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white px-3 py-2 focus:outline-none focus:border-emerald-400/40 resize-none placeholder:text-white/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Valor proposto (R$) *</label>
                        <input value={applyForm.value} onChange={e => setApplyForm(f => ({ ...f, value: e.target.value }))}
                          placeholder="Ex: 3.500,00"
                          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white px-3 py-2 focus:outline-none focus:border-emerald-400/40 placeholder:text-white/20 font-mono" />
                      </div>
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Prazo estimado (dias)</label>
                        <input type="number" min="1" value={applyForm.days} onChange={e => setApplyForm(f => ({ ...f, days: e.target.value }))}
                          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white px-3 py-2 focus:outline-none focus:border-emerald-400/40" />
                      </div>
                    </div>
                    {applyForm.value && (() => {
                      const v = Math.round(parseFloat(applyForm.value.replace(/\./g, "").replace(",", ".")) * 100);
                      if (!v) return null;
                      const fee = Math.round(v * 0.2);
                      return (
                        <div className="rounded-lg bg-white/[0.03] p-3 text-xs text-white/40 space-y-1">
                          <div className="flex justify-between"><span>Taxa da plataforma (20%)</span><span className="font-mono text-white/60">- {fmtMoney(fee)}</span></div>
                          <div className="flex justify-between font-semibold text-emerald-400"><span>Você recebe</span><span className="font-mono">{fmtMoney(v - fee)}</span></div>
                        </div>
                      );
                    })()}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="ghost" className="text-white/40 hover:text-white" onClick={() => setApplyModal(false)}>Cancelar</Button>
                      <Button size="sm" className="flex-1 bg-emerald-400 text-[#080D14] hover:bg-emerald-300 font-semibold"
                        onClick={handleApply} disabled={applying || !applyForm.proposal.trim() || !applyForm.value}>
                        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar candidatura"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Panel footer */}
              {!alreadyApplied(selectedProject.id) && !applyModal && (
                <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
                  <Button className="w-full bg-emerald-400 text-[#080D14] hover:bg-emerald-300 font-semibold" onClick={() => setApplyModal(true)}>
                    Candidatar-se a este projeto
                  </Button>
                </div>
              )}
              {alreadyApplied(selectedProject.id) && (
                <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Candidatura enviada
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Status card ────────────────────────────────────────────────
function StatusCard({ status, reason, onRefresh }: { status: VerifStatus; reason?: string; onRefresh: () => void }) {
  const configs: Record<VerifStatus, { icon: any; color: string; border: string; bg: string; title: string; desc: string }> = {
    pending:   { icon: Clock,         color: "text-amber-400",   border: "border-amber-400/20",   bg: "bg-amber-400/5",   title: "Documentação em análise",              desc: "Recebemos sua solicitação. Nossa equipe fará a revisão em até 48 horas úteis." },
    in_review: { icon: Clock,         color: "text-cyan-400",    border: "border-cyan-400/20",    bg: "bg-cyan-400/5",    title: "Em revisão",                           desc: "Sua documentação está sendo analisada pela nossa equipe." },
    approved:  { icon: CheckCircle2,  color: "text-emerald-400", border: "border-emerald-400/20", bg: "bg-emerald-400/5", title: "Perfil verificado!",                   desc: "Sua identidade foi confirmada." },
    flagged:   { icon: AlertTriangle, color: "text-orange-400",  border: "border-orange-400/20",  bg: "bg-orange-400/5",  title: "Revisão adicional necessária",         desc: "Precisamos de mais informações. Entre em contato com o suporte." },
    rejected:  { icon: XCircle,       color: "text-red-400",     border: "border-red-400/20",     bg: "bg-red-400/5",     title: "",                                     desc: "" },
  };
  const c = configs[status];
  if (!c || status === "rejected") return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border p-6 mb-8 flex items-start gap-4", c.border, c.bg)}>
      <c.icon className={cn("h-6 w-6 shrink-0 mt-0.5", c.color)} />
      <div className="flex-1"><p className={cn("font-semibold", c.color)}>{c.title}</p><p className="text-sm text-white/50 mt-1">{c.desc}</p></div>
      <button onClick={onRefresh} className="text-white/30 hover:text-white/60 transition-colors"><RefreshCw className="h-4 w-4" /></button>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ConsultorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "", cpf: "", phone: "", birth_date: "",
    professional_type: "advogado", registration_number: "",
    registration_state: "SP", years_experience: "1",
    specialties: [] as string[], bio: "", linkedin_url: "",
    doc_identity: null as File | null, doc_selfie: null as File | null, doc_professional: null as File | null,
    terms: false,
  });

  const profType = PROF_TYPES.find(p => p.id === form.professional_type)!;
  const cpfValid = form.cpf.replace(/\D/g, "").length === 11 && validateCPF(form.cpf);

  useEffect(() => { loadVerification(); }, []);

  const loadVerification = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUserId(user.id);
    const { data } = await (supabase.from("consultant_verifications" as any).select("*").eq("user_id", user.id).maybeSingle());
    setVerification(data);
    setLoading(false);
  };

  const uploadFile = async (file: File, type: string, uid: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${uid}/${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("consultant-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!form.terms) { toast({ title: "Aceite os termos para continuar", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let doc_identity = "", doc_selfie = "", doc_professional = "";
      if (form.doc_identity) doc_identity = await uploadFile(form.doc_identity, "identity", user.id);
      if (form.doc_selfie) doc_selfie = await uploadFile(form.doc_selfie, "selfie", user.id);
      if (form.doc_professional) doc_professional = await uploadFile(form.doc_professional, "professional", user.id);
      const payload = { ...form, cpf: form.cpf.replace(/\D/g, ""), doc_identity, doc_selfie, doc_professional };
      const { score, flags } = await calcRiskScore(payload, user.id);
      const status: VerifStatus = score >= 80 ? "flagged" : "pending";
      const { error } = await (supabase.from("consultant_verifications" as any).upsert({
        user_id: user.id, full_name: form.full_name, cpf: form.cpf.replace(/\D/g, ""),
        phone: form.phone, birth_date: form.birth_date || null,
        professional_type: form.professional_type, registration_number: form.registration_number,
        registration_state: form.registration_state, specialties: form.specialties,
        years_experience: parseInt(form.years_experience), bio: form.bio, linkedin_url: form.linkedin_url,
        doc_identity, doc_selfie, doc_professional, status, risk_score: score, risk_flags: flags,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" }));
      if (error) throw error;
      toast({ title: status === "flagged" ? "Documentação enviada — revisão adicional necessária" : "Documentação enviada com sucesso!" });
      loadVerification();
    } catch (err: any) { toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" }); }
    setSubmitting(false);
  };

  const toggleSpecialty = (s: string) => setForm(f => ({ ...f, specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s] }));
  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(223 27% 7%)" }}>
      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
    </div>
  );

  if (verification?.status === "approved") {
    return <ConsultorDashboard verification={verification} userId={userId} onLogout={handleLogout} />;
  }

  // ── Verification flow ──────────────────────────────────────────
  return (
    <div className="min-h-screen text-white" style={{ background: "hsl(223 27% 7%)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 rounded-full bg-amber-500/6 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>
      <header className="relative z-10 border-b border-white/[0.06] bg-[#080D14]/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Scale className="w-4 h-4 text-[#080D14]" />
            </div>
            <span className="text-white font-bold tracking-widest uppercase text-xs" style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}>Intelicite</span>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-amber-400 text-sm font-semibold">Consultor</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {verification && verification.status !== "rejected" && (
          <StatusCard status={verification.status} reason={verification.rejection_reason} onRefresh={loadVerification} />
        )}
        {verification?.status === "rejected" && (
          <div className="mb-8 rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
            <div className="flex items-start gap-4">
              <XCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-400">Verificação rejeitada</p>
                <p className="text-sm text-white/50 mt-1">{verification.rejection_reason || "Documentos insuficientes ou inválidos."}</p>
                <Button size="sm" className="mt-4 bg-amber-400 text-[#080D14] hover:bg-amber-300" onClick={() => { setVerification(null); setStep(1); }}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reenviar documentos
                </Button>
              </div>
            </div>
          </div>
        )}

        {(!verification || verification.status === "rejected") && (
          <>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" /> Verificação de Identidade Obrigatória
              </div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Solicite sua verificação</h1>
              <p className="text-white/50 text-sm">A verificação é obrigatória para atuar com projetos de licitação na plataforma. Análise em até 48 horas.</p>
            </div>

            <div className="flex items-center gap-3 mb-8">
              {[{ n: 1, icon: User, label: "Dados pessoais" },{ n: 2, icon: Briefcase, label: "Perfil profissional" },{ n: 3, icon: FileText, label: "Documentos" }].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  <button onClick={() => step > s.n && setStep(s.n)}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      step === s.n ? "bg-amber-400 text-[#080D14]" : step > s.n ? "bg-amber-400/20 text-amber-400 cursor-pointer" : "bg-white/5 text-white/30")}>
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                  {i < 2 && <ChevronRight className="h-4 w-4 text-white/20" />}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label className="text-white/70 text-xs">Nome completo *</Label>
                      <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" placeholder="Seu nome completo" /></div>
                    <div><Label className="text-white/70 text-xs">CPF *</Label>
                      <div className="relative mt-1">
                        <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))}
                          className={cn("bg-white/5 border-white/10 text-white pr-10", form.cpf.replace(/\D/g,"").length === 11 && (cpfValid ? "border-emerald-400/50" : "border-red-400/50"))} placeholder="000.000.000-00" />
                        {form.cpf.replace(/\D/g,"").length === 11 && (cpfValid ? <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" /> : <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />)}
                      </div>
                      {form.cpf.replace(/\D/g,"").length === 11 && !cpfValid && <p className="text-red-400 text-xs mt-1">CPF inválido</p>}</div>
                    <div><Label className="text-white/70 text-xs">Telefone / WhatsApp *</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} className="mt-1 bg-white/5 border-white/10 text-white" placeholder="(11) 99999-9999" /></div>
                    <div><Label className="text-white/70 text-xs">Data de nascimento</Label>
                      <Input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" /></div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(2)} disabled={!form.full_name || !cpfValid || !form.phone} className="bg-amber-400 text-[#080D14] hover:bg-amber-300">
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div><Label className="text-white/70 text-xs">Tipo de profissional *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {PROF_TYPES.map(p => (
                        <button key={p.id} onClick={() => setForm(f => ({ ...f, professional_type: p.id }))}
                          className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                            form.professional_type === p.id ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 text-white/50 hover:border-white/20")}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {profType.reg && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div><Label className="text-white/70 text-xs">Nº de registro ({profType.reg}) *</Label>
                        <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" placeholder={`Número ${profType.reg}`} /></div>
                      <div><Label className="text-white/70 text-xs">UF do registro</Label>
                        <select value={form.registration_state} onChange={e => setForm(f => ({ ...f, registration_state: e.target.value }))}
                          className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2">
                          {UFS.map(uf => <option key={uf} value={uf} className="bg-[#080D14]">{uf}</option>)}
                        </select></div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><Label className="text-white/70 text-xs">Anos de experiência</Label>
                      <Input type="number" min="0" max="50" value={form.years_experience} onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" /></div>
                    <div><Label className="text-white/70 text-xs">LinkedIn (opcional)</Label>
                      <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} className="mt-1 bg-white/5 border-white/10 text-white" placeholder="linkedin.com/in/..." /></div>
                  </div>
                  <div><Label className="text-white/70 text-xs">Especialidades</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {SPECIALTIES.map(s => (
                        <button key={s} onClick={() => toggleSpecialty(s)}
                          className={cn("px-3 py-1 rounded-full text-xs border transition-all", form.specialties.includes(s) ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 text-white/40 hover:border-white/20")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><Label className="text-white/70 text-xs">Bio profissional</Label>
                    <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} placeholder="Descreva sua experiência em licitações..."
                      className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-amber-400/50" /></div>
                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" onClick={() => setStep(1)} className="text-white/50">Voltar</Button>
                    <Button onClick={() => setStep(3)} className="bg-amber-400 text-[#080D14] hover:bg-amber-300">Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 flex items-start gap-3">
                    <Shield className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/60">Os documentos são armazenados com criptografia e usados exclusivamente para verificação de identidade. Não compartilhamos seus dados com terceiros.</p>
                  </div>
                  {[
                    { key: "doc_identity", icon: FileText, label: "Documento de identidade (RG ou CNH — frente)", required: true },
                    { key: "doc_selfie", icon: Camera, label: "Selfie segurando o documento aberto", required: true },
                    { key: "doc_professional", icon: Briefcase, label: `Carteira profissional (${profType.reg || "certificado"})`, required: false },
                  ].map(({ key, icon: Icon, label, required }) => (
                    <div key={key}>
                      <Label className="text-white/70 text-xs">{label} {required ? "*" : "(recomendado)"}</Label>
                      <label className={cn("mt-2 flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-all",
                        (form as any)[key] ? "border-amber-400/40 bg-amber-400/5" : "border-white/10 hover:border-white/20")}>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setForm(f => ({ ...f, [key]: e.target.files?.[0] || null }))} />
                        <Icon className={cn("h-5 w-5 shrink-0", (form as any)[key] ? "text-amber-400" : "text-white/30")} />
                        <div>
                          <p className="text-sm text-white/70">{(form as any)[key] ? ((form as any)[key] as File).name : "Clique para selecionar arquivo"}</p>
                          <p className="text-xs text-white/30">JPG, PNG ou PDF — máx. 10MB</p>
                        </div>
                        {(form as any)[key] && <CheckCircle2 className="h-4 w-4 text-amber-400 ml-auto" />}
                      </label>
                    </div>
                  ))}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.checked }))} className="mt-1 accent-amber-400" />
                    <span className="text-xs text-white/50">Declaro que as informações e documentos enviados são verdadeiros e autorizo a verificação de meus dados para fins de credenciamento na plataforma Intelicite.</span>
                  </label>
                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" onClick={() => setStep(2)} className="text-white/50">Voltar</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !form.doc_identity || !form.doc_selfie || !form.terms} className="bg-amber-400 text-[#080D14] hover:bg-amber-300 min-w-[140px]">
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar verificação"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
