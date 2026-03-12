import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Shield } from "lucide-react";
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
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--accent) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent) / 0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />

      <div className="container relative z-10">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Copy */}
          <div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent"
            >
              <Shield className="h-3.5 w-3.5" />
              Plataforma de IA para licitações
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl font-extrabold leading-[1.08] tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            >
              Conformidade com a{" "}
              <span className="text-gradient-gold">Lei&nbsp;14.133</span>{" "}
              simplificada por IA
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-lg text-base leading-relaxed text-primary-foreground/60 md:text-lg"
            >
              Gere ETPs, Termos de Referência, valide editais e consulte a
              legislação com inteligência artificial. Reduza riscos legais e
              economize horas de trabalho.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="mt-10 flex flex-col gap-3 sm:flex-row"
            >
              <Link to="/signup">
                <Button variant="gold" size="lg" className="text-base px-8 h-13">
                  Comece grátis por 7 dias
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#funcionalidades">
                <Button
                  variant="hero-outline"
                  size="lg"
                  className="text-base px-8 h-13 text-primary-foreground/70 border-primary-foreground/15 hover:bg-primary-foreground/5"
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
              className="mt-6 flex items-center gap-5 text-xs text-primary-foreground/40"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Dados protegidos (LGPD)
              </span>
              <span className="h-3 w-px bg-primary-foreground/20" />
              <span>Sem cartão de crédito</span>
            </motion.div>
          </div>

          {/* Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-2 shadow-2xl shadow-black/30 backdrop-blur-sm">
              <img
                src={heroMockup}
                alt="Interface do Intelicite — assistente jurídico de IA"
                className="w-full rounded-xl"
                loading="eager"
              />
            </div>
            {/* Floating accent element */}
            <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-2xl bg-gradient-gold opacity-20 blur-2xl" />
            <div className="absolute -top-4 -right-4 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
