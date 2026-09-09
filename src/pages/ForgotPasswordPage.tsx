import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset } from "@/lib/emailUtils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await sendPasswordReset(email);
    setLoading(false);
    // Sempre mostra sucesso — não revelamos se o e-mail existe.
    setSent(true);
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

        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Verifique seu e-mail
            </h1>
            <p className="text-sm text-white/50 mb-8 leading-relaxed">
              Se existir uma conta associada a <span className="text-white/80">{email}</span>,
              enviamos um link para redefinir sua senha. O link expira em 1 hora.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-sm text-cyan-400 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Esqueceu a senha?
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#080D14] font-semibold text-sm transition-all duration-200 disabled:opacity-50 shadow-[0_0_20px_-4px_hsl(190_95%_50%/0.4)]"
              >
                {loading ? "Enviando..." : "Enviar link"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-white/30">
              <Link to="/login" className="inline-flex items-center gap-1 text-cyan-400 hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
