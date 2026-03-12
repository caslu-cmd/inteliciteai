import { motion } from "framer-motion";
import { useParallax } from "@/hooks/useParallax";
import {
  MessageSquare,
  FileText,
  Search,
  Scale,
  CheckSquare,
  Calculator,
  type LucideIcon,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const features: { icon: LucideIcon; title: string; description: string; glow: "cyan" | "purple" }[] = [
  {
    icon: MessageSquare,
    title: "Assistente Jurídico IA",
    description:
      "Chat inteligente especializado na Lei 14.133/2021. Faça perguntas, anexe PDFs e receba respostas estruturadas.",
    glow: "cyan",
  },
  {
    icon: FileText,
    title: "Gerador de ETP e TR",
    description:
      "Formulários guiados que geram Estudos Técnicos Preliminares e Termos de Referência prontos para exportar.",
    glow: "purple",
  },
  {
    icon: Search,
    title: "Validador de Editais",
    description:
      "Upload de edital em PDF para análise automática com relatório técnico e identificação de riscos.",
    glow: "cyan",
  },
  {
    icon: Scale,
    title: "Diagnóstico de Licitação",
    description:
      "Informe valor, urgência e tipo para receber a modalidade recomendada com fundamentação legal.",
    glow: "purple",
  },
  {
    icon: CheckSquare,
    title: "Checklist de Qualificação",
    description:
      "Geração dinâmica de checklist conforme tipo de contratação e objeto licitado.",
    glow: "cyan",
  },
  {
    icon: Calculator,
    title: "Cotação Inteligente",
    description:
      "Monte propostas, estime preços e estruture custos com sugestões inteligentes.",
    glow: "purple",
  },
];

export default function FeaturesSection() {
  const { ref: parallaxRef, offset } = useParallax(0.08);
  return (
    <section ref={parallaxRef} id="funcionalidades" className="relative py-24 md:py-32 bg-landing-bg overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 grid-tech" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-landing-cyan/20 to-transparent" />

      <div className="container relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          custom={0}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="mb-3 text-xs font-futuristic font-semibold uppercase tracking-[0.2em] text-landing-cyan">
            Módulos
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-landing-text md:text-4xl">
            Ferramentas que{" "}
            <span className="text-gradient-cyan-purple">transformam</span> sua gestão
          </h2>
          <p className="mt-4 text-landing-text-muted">
            Cada módulo foi desenvolvido especificamente para atender às
            exigências da Nova Lei de Licitações.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ transform: `translateY(${offset * 0.3}px)` }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              custom={i}
              className="group relative overflow-hidden rounded-2xl glass-card p-7 transition-all duration-500 hover:border-landing-cyan/30 hover:shadow-cyan-glow"
            >
              {/* Hover gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${
                f.glow === "cyan"
                  ? "from-landing-cyan/[0.05] to-transparent"
                  : "from-landing-purple/[0.05] to-transparent"
              } opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />

              {/* Corner accent line */}
              <div className={`absolute top-0 left-0 w-12 h-px ${
                f.glow === "cyan" ? "bg-landing-cyan/40" : "bg-landing-purple/40"
              }`} />
              <div className={`absolute top-0 left-0 h-12 w-px ${
                f.glow === "cyan" ? "bg-landing-cyan/40" : "bg-landing-purple/40"
              }`} />

              <div className="relative">
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                  f.glow === "cyan"
                    ? "bg-landing-cyan/10 group-hover:bg-landing-cyan/20 group-hover:shadow-cyan-glow"
                    : "bg-landing-purple/10 group-hover:bg-landing-purple/20 group-hover:shadow-purple-glow"
                }`}>
                  <f.icon className={`h-5 w-5 ${
                    f.glow === "cyan" ? "text-landing-cyan" : "text-landing-purple"
                  }`} />
                </div>
                <h3 className="mb-2 text-lg font-display font-semibold text-landing-text">{f.title}</h3>
                <p className="text-sm leading-relaxed text-landing-text-muted">
                  {f.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}