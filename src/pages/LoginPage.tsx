import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      return;
    }

    // Check account approval status
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, platform_role")
      .eq("id", data.user!.id)
      .single();

    const acctStatus = profile?.account_status;
    if (acctStatus === "rejected") {
      await supabase.auth.signOut();
      toast({ title: "Acesso negado", description: "Sua conta foi desativada.", variant: "destructive" });
      return;
    }

    const platformRole = profile?.platform_role || data.user?.user_metadata?.role || "gestor";
    if (platformRole === "licitante") navigate("/licitante");
    else if (platformRole === "consultor") navigate("/consultor");
    else navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "hsl(223 27% 7%)" }}
    >
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-cyan-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-violet-500/8 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex items-center justify-center mb-10">
          <img src={logoWhite} alt="Intelicite" className="h-10 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Entrar na plataforma
        </h1>
        <p className="text-sm text-white/40 mb-8">
          Acesse seu painel com suas credenciais.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type="email"
                placeholder="seu@email.com"
                className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-xs">Senha</Label>
              <a href="#" className="text-xs text-cyan-400 hover:underline">Esqueceu a senha?</a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-10 pr-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#080D14] font-semibold text-sm transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_-4px_hsl(190_95%_50%/0.4)]"
          >
            {loading ? "Entrando..." : "Entrar"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-white/30">
          Não tem uma conta?{" "}
          <Link to="/signup" className="text-cyan-400 hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
