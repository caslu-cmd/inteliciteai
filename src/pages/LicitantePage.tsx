import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FileSearch, Globe, BarChart3, Award, DollarSign, FileText,
  Scale, LogOut, Bell, ChevronRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  { icon: FileSearch, label: "Scanner de Editais", desc: "Análise de risco e pontuação de vitória por IA", status: "beta" },
  { icon: Globe, label: "Radar de Oportunidades", desc: "Monitoramento automático de oportunidades do PNCP", status: "beta" },
  { icon: BarChart3, label: "Análise Competitiva", desc: "Inteligência sobre concorrentes e mercado", status: "soon" },
  { icon: Award, label: "Habilitação", desc: "Gestão de documentos e requisitos de habilitação", status: "soon" },
  { icon: DollarSign, label: "Precificação IA", desc: "Estratégia de preço para maximizar competitividade", status: "soon" },
  { icon: FileText, label: "Minutas e Contratos", desc: "Templates jurídicos prontos para uso", status: "soon" },
];

const STATUS = {
  beta: { label: "Beta", cls: "bg-violet-400/10 text-violet-400 border border-violet-400/20" },
  soon: { label: "Em breve", cls: "bg-white/5 text-white/40 border border-white/10" },
};

export default function LicitantePage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "hsl(223 27% 7%)" }}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/8 blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06] bg-[#080D14]/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
              <Scale className="w-4 h-4 text-[#080D14]" />
            </div>
            <span className="text-white font-bold tracking-widest uppercase text-xs" style={{ fontFamily: "'Orbitron', system-ui, sans-serif" }}>
              Intelicite
            </span>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <span className="text-violet-400 text-sm font-semibold">Licitante</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all">
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-400/10 text-violet-400 border border-violet-400/20 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Plataforma Licitante — Acesso Antecipado
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Bem-vindo ao{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(265 90% 60%), hsl(265 80% 75%))" }}>
              Licitante
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-xl leading-relaxed">
            Sua plataforma de inteligência competitiva para vencer mais licitações públicas está sendo construída.
            Você está entre os primeiros a ter acesso.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {FEATURES.map((f, i) => {
            const s = STATUS[f.status as keyof typeof STATUS];
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.03] p-6 hover:border-violet-400/25 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl border border-violet-400/20 bg-violet-400/5 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                </div>
                <h3 className="font-semibold text-white mb-1">{f.label}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div>
            <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Enquanto preparamos tudo para você...
            </h3>
            <p className="text-white/40 text-sm">
              Experimente o Notebook IA do Intelicite para analisar editais e extrair informações jurídicas.
            </p>
          </div>
          <Link
            to="/dashboard/notebook"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-all duration-200 whitespace-nowrap"
          >
            Abrir Notebook IA
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
