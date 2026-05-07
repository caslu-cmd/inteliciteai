import { motion } from "framer-motion";
import { Clock, LogOut, Mail } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function PendingApprovalPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-white"
      style={{ background: "hsl(223 27% 7%)" }}
    >
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-cyan-500/8 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-violet-500/6 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-md w-full text-center"
      >
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <img src={logoWhite} alt="Intelicite" className="h-10 w-auto" />
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 flex items-center justify-center mx-auto mb-8">
          <Clock className="w-10 h-10 text-cyan-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Cadastro em análise
        </h1>

        <p className="text-white/50 leading-relaxed mb-8">
          Seu cadastro foi recebido e está aguardando aprovação.
          Em breve você receberá um e-mail confirmando o acesso à plataforma.
        </p>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 text-left mb-8">
          <p className="text-xs text-white/40 uppercase tracking-widest font-medium mb-3">O que acontece agora</p>
          <ul className="space-y-3">
            {[
              "Nosso time analisa seu perfil em até 24 horas",
              "Você recebe um e-mail quando o acesso for liberado",
              "Alguns cadastros recebem acesso gratuito vitalício",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                <div className="w-5 h-5 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-cyan-400 text-[10px] font-bold">{i + 1}</span>
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="mailto:contato@intelicite.com.br"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-sm font-medium transition-all duration-200 mb-4"
        >
          <Mail className="w-4 h-4" />
          Falar com o suporte
        </a>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-3 text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </motion.div>
    </div>
  );
}
