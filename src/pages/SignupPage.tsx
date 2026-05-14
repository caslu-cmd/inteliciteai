import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff,
  CheckCircle2, XCircle, Briefcase, Handshake, ChevronLeft,
} from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Role = "gestor" | "licitante" | "consultor";

const ROLES = [
  {
    id: "gestor" as Role,
    name: "Agente Público",
    platform: "Intelicite",
    desc: "Conduza licitações em conformidade com a Lei 14.133/2021",
    icon: Building2,
    badge: "Lei 14.133/2021",
    color: "cyan",
    border: "border-cyan-400/30",
    bg: "bg-cyan-400/5",
    badgeCss: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20",
    text: "text-cyan-400",
    btn: "bg-cyan-400 hover:bg-cyan-300 text-[#080D14]",
    dot: "bg-cyan-400",
    features: ["Gerador de ETP e TR", "Checklist de conformidade", "Notebook IA Jurídico", "Validador de editais"],
  },
  {
    id: "licitante" as Role,
    name: "Empresa Licitante",
    platform: "Licitante",
    desc: "Vença mais contratos com inteligência competitiva",
    icon: Briefcase,
    badge: "IA Competitiva",
    color: "purple",
    border: "border-violet-400/30",
    bg: "bg-violet-400/5",
    badgeCss: "bg-violet-400/10 text-violet-400 border border-violet-400/20",
    text: "text-violet-400",
    btn: "bg-violet-500 hover:bg-violet-400 text-white",
    dot: "bg-violet-400",
    features: ["Scanner de editais", "Radar de oportunidades", "Análise competitiva", "Precificação IA"],
  },
  {
    id: "consultor" as Role,
    name: "Consultor Especialista",
    platform: "Consultor",
    desc: "Monetize sua expertise em licitações públicas",
    icon: Handshake,
    badge: "Marketplace",
    color: "amber",
    border: "border-amber-400/30",
    bg: "bg-amber-400/5",
    badgeCss: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
    text: "text-amber-400",
    btn: "bg-amber-400 hover:bg-amber-300 text-[#080D14]",
    dot: "bg-amber-400",
    features: ["Receba projetos", "Envie propostas", "Pagamento seguro (escrow)", "Chat direto"],
  },
];

const REDIRECT: Record<Role, string> = {
  gestor: "/dashboard",
  licitante: "/licitante",
  consultor: "/consultor",
};

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordRules = useMemo(() => [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Letra maiúscula", valid: /[A-Z]/.test(password) },
    { label: "Número", valid: /[0-9]/.test(password) },
    { label: "Caractere especial (!@#$...)", valid: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  const passwordValid = passwordRules.every((r) => r.valid);
  const selectedRole = ROLES.find((r) => r.id === role);

  const handleSelectRole = (r: Role) => {
    setRole(r);
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast({ title: "Senha fraca", description: "A senha não atende todos os requisitos.", variant: "destructive" });
      return;
    }
    if (!role) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, organization: org, role } },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
    } else {
      navigate(REDIRECT[role]);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "hsl(223 27% 7%)" }}
    >
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-violet-500/8 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-10">
          <img src={logoWhite} alt="Intelicite" className="h-10 w-auto" />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                  Qual é o seu perfil?
                </h1>
                <p className="text-white/50">Escolha o perfil que melhor descreve como você usará o Intelicite.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {ROLES.map((r, i) => (
                  <motion.button
                    key={r.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    onClick={() => handleSelectRole(r.id)}
                    className={`relative rounded-2xl border p-7 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${r.border} ${r.bg} group`}
                  >
                    <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r opacity-50 ${r.color === "cyan" ? "from-cyan-400/0 via-cyan-400 to-cyan-400/0" : r.color === "purple" ? "from-violet-400/0 via-violet-400 to-violet-400/0" : "from-amber-400/0 via-amber-400 to-amber-400/0"}`} />

                    <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium mb-5 ${r.badgeCss}`}>
                      {r.badge}
                    </div>

                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${r.bg} border ${r.border}`}>
                      <r.icon className={`w-5 h-5 ${r.text}`} />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                      {r.name}
                    </h3>
                    <p className={`text-xs font-semibold mb-3 ${r.text}`}>{r.platform}</p>
                    <p className="text-sm text-white/50 leading-relaxed mb-5">{r.desc}</p>

                    <ul className="space-y-2">
                      {r.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.dot}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className={`mt-6 flex items-center gap-2 text-sm font-medium ${r.text}`}>
                      Selecionar
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.button>
                ))}
              </div>

              <p className="text-center mt-8 text-sm text-white/30">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-cyan-400 hover:underline">
                  Entrar
                </Link>
              </p>
            </motion.div>
          )}

          {step === 2 && selectedRole && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-md mx-auto"
            >
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-8 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Trocar perfil
              </button>

              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 ${selectedRole.badgeCss}`}>
                <selectedRole.icon className="w-3.5 h-3.5" />
                {selectedRole.name} — {selectedRole.platform}
              </div>

              <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                Criar sua conta
              </h1>
              <p className="text-sm text-white/50 mb-8">
                Preencha seus dados para começar gratuitamente.
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <Input
                        placeholder="Seu nome"
                        className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Organização</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <Input
                        placeholder="Órgão/Empresa"
                        className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-xs">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      className="pl-10 pr-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {passwordRules.map((r) => (
                        <div key={r.label} className="flex items-center gap-1.5 text-xs">
                          {r.valid
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                            : <XCircle className="h-3 w-3 text-white/20 flex-shrink-0" />}
                          <span className={r.valid ? "text-emerald-400" : "text-white/30"}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="lgpd"
                    checked={agreed}
                    onCheckedChange={(c) => setAgreed(c === true)}
                    className="mt-0.5 border-white/20"
                  />
                  <label htmlFor="lgpd" className="text-xs text-white/40 leading-relaxed cursor-pointer">
                    Li e concordo com os{" "}
                    <a href="#" className="text-cyan-400 hover:underline">Termos de Uso</a> e a{" "}
                    <a href="#" className="text-cyan-400 hover:underline">Política de Privacidade</a>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!agreed || !passwordValid || loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${selectedRole.btn}`}
                >
                  {loading ? "Criando conta..." : "Criar conta e começar"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-center mt-6 text-sm text-white/30">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-cyan-400 hover:underline">
                  Entrar
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
