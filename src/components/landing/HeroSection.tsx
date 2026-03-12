import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Shield, Sparkles } from "lucide-react";
import heroMockup from "@/assets/hero-mockup.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-36 pb-20 md:pt-48 md:pb-32 bg-gradient-hero">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-tech" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-landing-cyan/5 blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-landing-purple/8 blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-landing-blue/3 blur-[200px]" />

      {/* Floating particles */}
      <div className="absolute top-20 left-[10%] w-1 h-1 rounded-full bg-landing-cyan/60" style={{ animation: "float 4s ease-in-out infinite" }} />
      <div className="absolute top-40 right-[15%] w-1.5 h-1.5 rounded-full bg-landing-purple/50" style={{ animation: "float 5s ease-in-out infinite 1s" }} />
      <div className="absolute bottom-32 left-[20%] w-1 h-1 rounded-full bg-landing-cyan/40" style={{ animation: "float 6s ease-in-out infinite 2s" }} />
      <div className="absolute top-60 right-[30%] w-0.5 h-0.5 rounded-full bg-landing-purple/70" style={{ animation: "float 3.5s ease-in-out infinite 0.5s" }} />

      <div className="container relative z-10">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Copy */}
          <div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="mb-5 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-landing-cyan"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma de IA para licitações
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-landing-text md:text-5xl lg:text-6xl"
            >
              Plataforma de IA para{" "}
              <span className="text-gradient-cyan-purple">Licitações</span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-lg text-base leading-relaxed text-landing-text-muted md:text-lg"
            >
              Conformidade com a Lei 14.133 simplificada por Inteligência Artificial.
              Gere ETPs, Termos de Referência, valide editais e consulte a
              legislação com IA. Reduza riscos legais e economize horas de trabalho.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="mt-10 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/signup">
                 <Button size="lg" className="text-base px-10 h-14 bg-gradient-cyber text-white border-0 glow-cyan hover:opacity-90 font-semibold">
                  Comece grátis por 7 dias
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#funcionalidades">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-8 h-13 text-landing-text-muted border-landing-border bg-transparent hover:bg-landing-surface-2 hover:text-landing-text"
                >
                  Ver funcionalidades
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={4}
              className="mt-6 flex items-center gap-5 text-xs text-landing-text-muted"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-landing-cyan" /> Dados protegidos (LGPD)
              </span>
              <span className="h-3 w-px bg-landing-border" />
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-landing-purple" /> Sem cartão de crédito
              </span>
            </motion.div>
          </div>

          {/* Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl glass-card p-2 shadow-cyan-glow">
              <img
                src={heroMockup}
                alt="Interface do Intelicite — assistente jurídico de IA"
                className="w-full rounded-xl"
                loading="eager"
              />
              {/* Scan line effect */}
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-landing-cyan/30 to-transparent" style={{ animation: "float 3s ease-in-out infinite", top: "30%" }} />
              </div>
            </div>
            {/* Glow elements */}
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-landing-cyan/10 blur-3xl" />
            <div className="absolute -top-6 -right-6 h-40 w-40 rounded-full bg-landing-purple/10 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
