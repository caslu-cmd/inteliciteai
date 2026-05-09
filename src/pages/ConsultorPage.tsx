import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, LogOut, Bell, Upload, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronRight, Shield, FileText, User, Briefcase,
  Camera, Loader2, RefreshCw, Star, ExternalLink, MessageSquare,
  Award, MapPin, Phone, Linkedin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
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
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

async function calcRiskScore(data: any, userId: string) {
  const flags: string[] = [];
  let score = 0;

  // CPF algorithm
  if (!validateCPF(data.cpf)) { score += 50; flags.push("CPF inválido (algoritmo)"); }

  // Duplicate CPF
  const cpfClean = data.cpf.replace(/\D/g, "");
  const { data: dup } = await (supabase
    .from("consultant_verifications" as any)
    .select("id")
    .eq("cpf", cpfClean)
    .neq("user_id", userId)
    .maybeSingle());
  if (dup) { score += 60; flags.push("CPF já cadastrado por outro usuário"); }

  // Selfie missing
  if (!data.doc_selfie) { score += 20; flags.push("Selfie não enviada"); }

  // Identity doc missing
  if (!data.doc_identity) { score += 20; flags.push("Documento de identidade não enviado"); }

  // Professional registration missing for licensed professions
  const licensed = ["advogado", "contador", "engenheiro", "economista"];
  if (licensed.includes(data.professional_type) && !data.registration_number) {
    score += 25; flags.push("Número de registro profissional obrigatório para esta categoria");
  }

  // Account age < 24h
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.created_at) {
    const ageH = (Date.now() - new Date(user.created_at).getTime()) / 3600000;
    if (ageH < 24) { score += 20; flags.push("Conta criada há menos de 24 horas"); }
  }

  // Previous rejection
  const { data: prev } = await (supabase
    .from("consultant_verifications" as any)
    .select("status")
    .eq("user_id", userId)
    .eq("status", "rejected")
    .maybeSingle());
  if (prev) { score += 30; flags.push("Submissão anterior rejeitada"); }

  return { score: Math.min(score, 100), flags };
}

// ── Types ──────────────────────────────────────────────────────
type VerifStatus = "pending" | "in_review" | "approved" | "rejected" | "flagged";

const PROF_TYPES = [
  { id: "advogado", label: "Advogado(a)", reg: "OAB" },
  { id: "contador", label: "Contador(a)", reg: "CRC" },
  { id: "administrador", label: "Administrador(a)", reg: "CRA" },
  { id: "engenheiro", label: "Engenheiro(a)", reg: "CREA" },
  { id: "economista", label: "Economista", reg: "CORECON" },
  { id: "outro", label: "Outro", reg: "" },
];

const SPECIALTIES = [
  "Lei 14.133/2021", "Pregão Eletrônico", "Dispensa de Licitação",
  "Contratos Administrativos", "Impugnações e Recursos", "Compliance",
  "TI e Softwares", "Obras e Serviços de Engenharia", "Saúde",
  "Educação", "Auditoria", "Gestão de Contratos",
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// ── Consultor Dashboard (post-approval) ───────────────────────
function ConsultorDashboard({ verification, onLogout }: { verification: any; onLogout: () => void }) {
  const profType = PROF_TYPES.find(p => p.id === verification.professional_type);

  const stats = [
    { label: "Anos de experiência", value: verification.years_experience || "—", icon: Award },
    { label: "Especialidades", value: verification.specialties?.length || 0, icon: Star },
    { label: "Status", value: "Verificado ✓", icon: Shield },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: "hsl(223 27% 7%)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 rounded-full bg-emerald-500/6 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <header className="relative z-10 border-b border-white/[0.06] bg-[#080D14]/60 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
              <Scale className="w-4 h-4 text-[#080D14]" />
            </div>
            <span className="text-white font-bold tracking-widest uppercase text-xs" style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}>Intelicite</span>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-emerald-400 text-sm font-semibold">Consultor Verificado</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        {/* Profile hero */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6 mb-8 flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/20 text-2xl font-bold text-emerald-400">
            {(verification.full_name || "C").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{verification.full_name}</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Verificado
              </span>
            </div>
            <p className="text-white/50 text-sm mb-3">{profType?.label || verification.professional_type}</p>
            <div className="flex flex-wrap gap-3 text-xs text-white/40">
              {verification.phone && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{verification.phone}</span>
              )}
              {verification.registration_state && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{verification.registration_state}</span>
              )}
              {verification.linkedin_url && (
                <a href={`https://${verification.linkedin_url.replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <Linkedin className="h-3 w-3" /> LinkedIn <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center">
              <s.icon className="h-5 w-5 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Specialties */}
        {verification.specialties?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Especialidades</h2>
            <div className="flex flex-wrap gap-2">
              {verification.specialties.map((s: string) => (
                <span key={s} className="px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bio */}
        {verification.bio && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-6">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Bio profissional</h2>
            <p className="text-white/70 text-sm leading-relaxed">{verification.bio}</p>
          </motion.div>
        )}

        {/* Quick actions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Acessar plataformas</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Plataforma Gestor Público", desc: "ETP, TR, Validador, Notebook IA", path: "/dashboard", color: "text-amber-400 border-amber-400/20 bg-amber-400/5" },
              { label: "Plataforma Licitante", desc: "Radar PNCP, Scanner, Minutas", path: "/licitante", color: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5" },
            ].map(({ label, desc, path, color }) => (
              <Link key={path} to={path}
                className={`flex items-center gap-3 rounded-xl border p-4 transition-all hover:opacity-90 ${color}`}>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-white">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
              </Link>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ConsultorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "", cpf: "", phone: "", birth_date: "",
    professional_type: "advogado", registration_number: "",
    registration_state: "SP", years_experience: "1",
    specialties: [] as string[], bio: "", linkedin_url: "",
    doc_identity: null as File | null,
    doc_selfie: null as File | null,
    doc_professional: null as File | null,
    terms: false,
  });

  const profType = PROF_TYPES.find(p => p.id === form.professional_type)!;
  const cpfValid = form.cpf.replace(/\D/g, "").length === 11 && validateCPF(form.cpf);

  useEffect(() => {
    loadVerification();
  }, []);

  const loadVerification = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data } = await (supabase
      .from("consultant_verifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle());
    setVerification(data);
    setLoading(false);
  };

  const uploadFile = async (file: File, type: string, userId: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${type}_${Date.now()}.${ext}`;
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
        user_id: user.id,
        full_name: form.full_name,
        cpf: form.cpf.replace(/\D/g, ""),
        phone: form.phone,
        birth_date: form.birth_date || null,
        professional_type: form.professional_type,
        registration_number: form.registration_number,
        registration_state: form.registration_state,
        specialties: form.specialties,
        years_experience: parseInt(form.years_experience),
        bio: form.bio,
        linkedin_url: form.linkedin_url,
        doc_identity,
        doc_selfie,
        doc_professional,
        status,
        risk_score: score,
        risk_flags: flags,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" }));

      if (error) throw error;
      toast({ title: status === "flagged" ? "Documentação enviada — revisão adicional necessária" : "Documentação enviada com sucesso!" });
      loadVerification();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const toggleSpecialty = (s: string) => {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s) ? f.specialties.filter(x => x !== s) : [...f.specialties, s],
    }));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(223 27% 7%)" }}>
      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
    </div>
  );

  // Approved consultant gets a proper dashboard
  if (verification?.status === "approved") {
    return <ConsultorDashboard verification={verification} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "hsl(223 27% 7%)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 rounded-full bg-amber-500/6 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      {/* Header */}
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

        {/* ── STATUS CARDS ── */}
        {verification && verification.status !== "rejected" && (
          <StatusCard status={verification.status} reason={verification.rejection_reason} onRefresh={loadVerification} />
        )}

        {/* ── REJECTED — allow resubmit ── */}
        {verification?.status === "rejected" && (
          <div className="mb-8 rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
            <div className="flex items-start gap-4">
              <XCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-400">Verificação rejeitada</p>
                <p className="text-sm text-white/50 mt-1">{verification.rejection_reason || "Documentos insuficientes ou inválidos."}</p>
                <Button size="sm" className="mt-4 bg-amber-400 text-[#080D14] hover:bg-amber-300"
                  onClick={() => { setVerification(null); setStep(1); }}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reenviar documentos
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM ── */}
        {(!verification || verification.status === "rejected") && (
          <>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 text-xs font-medium mb-4">
                <Shield className="w-3.5 h-3.5" /> Verificação de Consultor
              </div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                Solicite sua verificação
              </h1>
              <p className="text-white/50 text-sm">
                Preencha seus dados e envie os documentos. A análise é feita em até 48 horas.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-8">
              {[
                { n: 1, icon: User, label: "Dados pessoais" },
                { n: 2, icon: Briefcase, label: "Perfil profissional" },
                { n: 3, icon: FileText, label: "Documentos" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  <button
                    onClick={() => step > s.n && setStep(s.n)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      step === s.n ? "bg-amber-400 text-[#080D14]" :
                      step > s.n ? "bg-amber-400/20 text-amber-400 cursor-pointer" :
                      "bg-white/5 text-white/30"
                    )}>
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                  {i < 2 && <ChevronRight className="h-4 w-4 text-white/20" />}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ── STEP 1: Personal ── */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70 text-xs">Nome completo *</Label>
                      <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        className="mt-1 bg-white/5 border-white/10 text-white" placeholder="Seu nome completo" />
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">CPF *</Label>
                      <div className="relative mt-1">
                        <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))}
                          className={cn("bg-white/5 border-white/10 text-white pr-10",
                            form.cpf.replace(/\D/g,"").length === 11 && (cpfValid ? "border-emerald-400/50" : "border-red-400/50"))}
                          placeholder="000.000.000-00" />
                        {form.cpf.replace(/\D/g,"").length === 11 && (
                          cpfValid
                            ? <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                            : <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                        )}
                      </div>
                      {form.cpf.replace(/\D/g,"").length === 11 && !cpfValid && (
                        <p className="text-red-400 text-xs mt-1">CPF inválido</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">Telefone / WhatsApp *</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                        className="mt-1 bg-white/5 border-white/10 text-white" placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">Data de nascimento</Label>
                      <Input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                        className="mt-1 bg-white/5 border-white/10 text-white" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(2)}
                      disabled={!form.full_name || !cpfValid || !form.phone}
                      className="bg-amber-400 text-[#080D14] hover:bg-amber-300">
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: Professional ── */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div>
                    <Label className="text-white/70 text-xs">Tipo de profissional *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {PROF_TYPES.map(p => (
                        <button key={p.id} onClick={() => setForm(f => ({ ...f, professional_type: p.id }))}
                          className={cn("px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                            form.professional_type === p.id
                              ? "border-amber-400 bg-amber-400/10 text-amber-400"
                              : "border-white/10 text-white/50 hover:border-white/20")}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {profType.reg && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/70 text-xs">Nº de registro ({profType.reg}) *</Label>
                        <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))}
                          className="mt-1 bg-white/5 border-white/10 text-white" placeholder={`Número ${profType.reg}`} />
                      </div>
                      <div>
                        <Label className="text-white/70 text-xs">UF do registro</Label>
                        <select value={form.registration_state} onChange={e => setForm(f => ({ ...f, registration_state: e.target.value }))}
                          className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2">
                          {UFS.map(uf => <option key={uf} value={uf} className="bg-[#080D14]">{uf}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70 text-xs">Anos de experiência</Label>
                      <Input type="number" min="0" max="50" value={form.years_experience}
                        onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))}
                        className="mt-1 bg-white/5 border-white/10 text-white" />
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">LinkedIn (opcional)</Label>
                      <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                        className="mt-1 bg-white/5 border-white/10 text-white" placeholder="linkedin.com/in/..." />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs">Especialidades (selecione as que se aplicam)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {SPECIALTIES.map(s => (
                        <button key={s} onClick={() => toggleSpecialty(s)}
                          className={cn("px-3 py-1 rounded-full text-xs border transition-all",
                            form.specialties.includes(s)
                              ? "border-amber-400 bg-amber-400/10 text-amber-400"
                              : "border-white/10 text-white/40 hover:border-white/20")}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70 text-xs">Bio profissional</Label>
                    <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                      rows={3} placeholder="Descreva sua experiência em licitações..."
                      className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-amber-400/50" />
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" onClick={() => setStep(1)} className="text-white/50">Voltar</Button>
                    <Button onClick={() => setStep(3)} className="bg-amber-400 text-[#080D14] hover:bg-amber-300">
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: Documents ── */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 flex items-start gap-3">
                    <Shield className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/60">
                      Os documentos são armazenados com criptografia e usados exclusivamente para verificação de identidade.
                      Não compartilhamos seus dados com terceiros.
                    </p>
                  </div>

                  {[
                    { key: "doc_identity", icon: FileText, label: "Documento de identidade (RG ou CNH — frente)", required: true },
                    { key: "doc_selfie", icon: Camera, label: "Selfie segurando o documento aberto", required: true },
                    { key: "doc_professional", icon: Briefcase, label: `Carteira profissional (${profType.reg || "certificado"})`, required: false },
                  ].map(({ key, icon: Icon, label, required }) => (
                    <div key={key}>
                      <Label className="text-white/70 text-xs">{label} {required ? "*" : "(recomendado)"}</Label>
                      <label className={cn(
                        "mt-2 flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-all",
                        (form as any)[key] ? "border-amber-400/40 bg-amber-400/5" : "border-white/10 hover:border-white/20"
                      )}>
                        <input type="file" accept="image/*,.pdf" className="hidden"
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.files?.[0] || null }))} />
                        <Icon className={cn("h-5 w-5 shrink-0", (form as any)[key] ? "text-amber-400" : "text-white/30")} />
                        <div>
                          <p className="text-sm text-white/70">
                            {(form as any)[key] ? ((form as any)[key] as File).name : "Clique para selecionar arquivo"}
                          </p>
                          <p className="text-xs text-white/30">JPG, PNG ou PDF — máx. 10MB</p>
                        </div>
                        {(form as any)[key] && <CheckCircle2 className="h-4 w-4 text-amber-400 ml-auto" />}
                      </label>
                    </div>
                  ))}

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.checked }))}
                      className="mt-1 accent-amber-400" />
                    <span className="text-xs text-white/50">
                      Declaro que as informações e documentos enviados são verdadeiros e autorizo a verificação
                      de meus dados para fins de credenciamento na plataforma Intelicite.
                    </span>
                  </label>

                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" onClick={() => setStep(2)} className="text-white/50">Voltar</Button>
                    <Button onClick={handleSubmit}
                      disabled={submitting || !form.doc_identity || !form.doc_selfie || !form.terms}
                      className="bg-amber-400 text-[#080D14] hover:bg-amber-300 min-w-[140px]">
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

// ── Status card component ──────────────────────────────────────
function StatusCard({ status, reason, onRefresh }: { status: VerifStatus; reason?: string; onRefresh: () => void }) {
  const configs: Record<VerifStatus, { icon: any; color: string; border: string; bg: string; title: string; desc: string }> = {
    pending: {
      icon: Clock, color: "text-amber-400", border: "border-amber-400/20", bg: "bg-amber-400/5",
      title: "Documentação em análise",
      desc: "Recebemos sua solicitação. Nossa equipe fará a revisão em até 48 horas úteis.",
    },
    in_review: {
      icon: Clock, color: "text-cyan-400", border: "border-cyan-400/20", bg: "bg-cyan-400/5",
      title: "Em revisão",
      desc: "Sua documentação está sendo analisada pela nossa equipe de verificação.",
    },
    approved: {
      icon: CheckCircle2, color: "text-emerald-400", border: "border-emerald-400/20", bg: "bg-emerald-400/5",
      title: "Perfil verificado!",
      desc: "Sua identidade foi confirmada. Você está habilitado para oferecer consultoria na plataforma.",
    },
    flagged: {
      icon: AlertTriangle, color: "text-orange-400", border: "border-orange-400/20", bg: "bg-orange-400/5",
      title: "Revisão adicional necessária",
      desc: "Precisamos de mais informações para concluir sua verificação. Entre em contato com o suporte.",
    },
    rejected: { icon: XCircle, color: "text-red-400", border: "border-red-400/20", bg: "bg-red-400/5", title: "", desc: "" },
  };

  const c = configs[status];
  if (!c || status === "rejected") return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border p-6 mb-8 flex items-start gap-4", c.border, c.bg)}>
      <c.icon className={cn("h-6 w-6 shrink-0 mt-0.5", c.color)} />
      <div className="flex-1">
        <p className={cn("font-semibold", c.color)}>{c.title}</p>
        <p className="text-sm text-white/50 mt-1">{c.desc}</p>
      </div>
      <button onClick={onRefresh} className="text-white/30 hover:text-white/60 transition-colors">
        <RefreshCw className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
