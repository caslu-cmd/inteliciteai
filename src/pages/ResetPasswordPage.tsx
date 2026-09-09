import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // O link do e-mail chega com o token de recuperação na URL; o supabase-js
  // detecta e estabelece uma sessão temporária (evento PASSWORD_RECOVERY).
  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        settled = true;
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setStatus("ready");
      }
    });

    // Se em alguns segundos não houver sessão, o link é inválido/expirado.
    const t = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use ao menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não conferem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao redefinir", description: error.message, variant: "destructive" });
      return;
    }

    setStatus("done");
    toast({ title: "Senha redefinida!", description: "Você já pode entrar com a nova senha." });
    setTimeout(() => navigate("/login"), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(223 27% 7%)" }}>
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

        {status === "checking" && (
          <p className="text-center text-sm text-white/50">Validando o link…</p>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Link inválido ou expirado
            </h1>
            <p className="text-sm text-white/50 mb-8 leading-relaxed">
              Este link de redefinição não é mais válido. Solicite um novo para continuar.
            </p>
            <Link to="/recuperar-senha" className="text-sm text-cyan-400 hover:underline">
              Solicitar novo link
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Senha redefinida!
            </h1>
            <p className="text-sm text-white/50">Redirecionando para o login…</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Criar nova senha
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Escolha uma nova senha para sua conta.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Confirmar nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 focus:border-cyan-400/50"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#080D14] font-semibold text-sm transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_-4px_hsl(190_95%_50%/0.4)]"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
