import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function CtaSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32 bg-landing-bg">
      {/* Glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-landing-cyan/5 blur-[150px]" />
      <div className="absolute top-1/2 left-1/3 w-[400px] h-[300px] rounded-full bg-landing-purple/5 blur-[120px]" />

      {/* Grid */}
      <div className="absolute inset-0 grid-tech" />

      {/* Top line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-landing-cyan/20 to-transparent" />

      <div className="container relative z-10 text-center">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-landing-text md:text-4xl"
        >
          Pronto para modernizar suas{" "}
          <span className="text-gradient-cyan-purple">licitações</span>?
        </motion.h2>
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={1}
          className="mx-auto mt-5 max-w-xl text-landing-text-muted"
        >
          Junte-se a agentes públicos e empresas que já utilizam a Intelicite
          para garantir conformidade e agilidade nos processos licitatórios.
        </motion.p>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={2}
          className="mt-10"
        >
          <Link to="/signup">
            <Button size="lg" className="text-base px-10 h-14 bg-gradient-cyber text-white glow-cyan hover:opacity-90 font-semibold">
              Começar agora — é grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}