import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const trialBenefits = [
  "Assistente Jurídico IA ilimitado",
  "Geradores de ETP e TR",
  "Validador de Editais",
  "Sem cartão de crédito",
];

export default function SignupPage() {
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast({ title: "Senha fraca", description: "A senha não atende todos os requisitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, organization: org } },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 bg-gradient-hero lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md"
        >
          <img src={logoWhite} alt="Intelicite" className="h-16 mb-6" />
          <h2 className="text-3xl font-bold text-primary-foreground">
            Comece seu trial de <span className="text-gradient-gold">7 dias grátis</span>
          </h2>
          <p className="mt-4 text-primary-foreground/60">
            Acesse todas as ferramentas da plataforma sem compromisso.
          </p>
          <ul className="mt-8 space-y-3">
            {trialBenefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-primary-foreground/80">
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden flex items-center gap-2 justify-center">
            <img src={logoWhite} alt="Intelicite" className="h-8" style={{ filter: "brightness(0) saturate(100%) invert(18%) sepia(68%) saturate(1200%) hue-rotate(190deg)" }} />
            <span className="text-xl font-bold">Inteli<span className="text-gradient-gold">cite</span></span>
          </div>

          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preencha seus dados para começar o período gratuito.
          </p>

          <form onSubmit={handleSignup} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" placeholder="Seu nome" className="pl-10" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org">Organização</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="org" placeholder="Órgão/Empresa" className="pl-10" value={org} onChange={(e) => setOrg(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="seu@email.com" className="pl-10" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRules.map((r) => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      {r.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className={r.valid ? "text-success" : "text-muted-foreground"}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  className="pl-10 pr-10"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="lgpd"
                checked={agreed}
                onCheckedChange={(c) => setAgreed(c === true)}
                className="mt-0.5"
              />
              <label htmlFor="lgpd" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Li e concordo com os{" "}
                <a href="#" className="text-accent hover:underline">Termos de Uso</a> e a{" "}
                <a href="#" className="text-accent hover:underline">Política de Privacidade</a> (LGPD).
              </label>
            </div>
            <Button variant="gold" className="w-full" type="submit" disabled={!agreed || !passwordValid || loading}>
              {loading ? "Criando..." : "Criar conta e iniciar trial"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Entrar
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
