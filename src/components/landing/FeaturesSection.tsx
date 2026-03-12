import { motion } from "framer-motion";
import {
  MessageSquare,
  FileText,
  Search,
  Scale,
  CheckSquare,
  Calculator,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const features = [
  {
    icon: MessageSquare,
    title: "Assistente Jurídico IA",
    description:
      "Chat inteligente especializado na Lei 14.133/2021. Faça perguntas, anexe PDFs e receba respostas estruturadas.",
  },
  {
    icon: FileText,
    title: "Gerador de ETP e TR",
    description:
      "Formulários guiados que geram Estudos Técnicos Preliminares e Termos de Referência prontos para exportar.",
  },
  {
    icon: Search,
    title: "Validador de Editais",
    description:
      "Upload de edital em PDF para análise automática com relatório técnico e identificação de riscos.",
  },
  {
    icon: Scale,
    title: "Diagnóstico de Licitação",
    description:
      "Informe valor, urgência e tipo de contratação para receber a modalidade recomendada com fundamentação legal.",
  },
  {
    icon: CheckSquare,
    title: "Checklist de Qualificação",
    description:
      "Geração dinâmica de checklist conforme tipo de contratação e objeto licitado.",
  },
  {
    icon: Calculator,
    title: "Cotação Inteligente",
    description:
      "Monte propostas, estime preços e estruture custos com sugestões inteligentes.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 md:py-32">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          custom={0}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            Módulos
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ferramentas que{" "}
            <span className="text-gradient-gold">transformam</span> sua gestão
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cada módulo foi desenvolvido especificamente para atender às
            exigências da Nova Lei de Licitações.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              custom={i}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/15">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
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
