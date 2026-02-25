import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  Search,
  CheckSquare,
  Calculator,
  ArrowRight,
  Scale,
  Zap,
  Lock,
} from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
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
      "Upload de edital em PDF para análise automática com relatório técnico e flags de risco.",
  },
  {
    icon: Scale,
    title: "Diagnóstico de Licitação",
    description:
      "Informe valor, urgência e tipo para receber a modalidade recomendada com fundamentação legal.",
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

const plans = [
  {
    name: "Gratuito",
    price: "R$ 0",
    period: "/ 7 dias",
    description: "Teste todas as funcionalidades por 7 dias",
    features: [
      "Acesso completo por 7 dias",
      "Assistente Jurídico IA",
      "Gerador de ETP e TR",
      "Validador de Editais",
      "Diagnóstico de Licitação",
    ],
    highlighted: false,
  },
  {
    name: "Profissional",
    price: "R$ 297",
    period: "/mês",
    description: "Acesso completo e ilimitado a todos os recursos",
    features: [
      "Assistente Jurídico IA ilimitado",
      "Gerador de ETP e TR",
      "Validador de Editais",
      "Diagnóstico de Licitação",
      "Checklist de Qualificação",
      "Exportação PDF e Word",
      "Cotação Inteligente",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    highlighted: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoWhite} alt="Intelicite" className="h-8" style={{ filter: "brightness(0) saturate(100%) invert(18%) sepia(68%) saturate(1200%) hue-rotate(190deg)" }} />
            <span className="text-xl font-bold tracking-tight text-foreground">
              Inteli<span className="text-gradient-gold">cite</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#funcionalidades" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#planos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </a>
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/signup">
              <Button variant="gold" size="sm">
                Teste grátis <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--gold)) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
        <div className="container relative z-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
          >
            <Zap className="h-3.5 w-3.5" />
            Plataforma de IA para licitações
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-primary-foreground md:text-6xl lg:text-7xl"
          >
            Conformidade com a{" "}
            <span className="text-gradient-gold">Lei 14.133</span>{" "}
            simplificada por IA
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/70"
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
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link to="/signup">
              <Button variant="gold" size="lg" className="text-base px-8 py-6">
                Comece grátis por 7 dias
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button variant="hero-outline" size="lg" className="text-base px-8 py-6 text-primary-foreground/80 border-primary-foreground/20 hover:bg-primary-foreground/5">
                Ver funcionalidades
              </Button>
            </a>
          </motion.div>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="mt-6 flex items-center justify-center gap-6 text-sm text-primary-foreground/50"
          >
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Dados protegidos (LGPD)</span>
            <span>•</span>
            <span>Sem cartão de crédito</span>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
            className="text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Ferramentas que <span className="text-gradient-gold">transformam</span> sua gestão
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Cada módulo foi desenvolvido especificamente para atender às
              exigências da Nova Lei de Licitações.
            </p>
          </motion.div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-navy hover:border-accent/30"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="bg-secondary/50 py-20 md:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Planos para cada <span className="text-gradient-gold">necessidade</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Comece com 7 dias grátis em qualquer plano. Cancele quando quiser.
            </p>
          </motion.div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-2xl border p-8 transition-shadow ${
                  plan.highlighted
                    ? "border-accent bg-card shadow-gold scale-[1.02]"
                    : "border-border bg-card hover:shadow-navy"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-gold px-4 py-1 text-xs font-semibold text-primary-foreground">
                    Mais popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <Link to="/signup" className="mt-6 block">
                  <Button
                    variant={plan.highlighted ? "gold" : "default"}
                    className="w-full"
                  >
                    Começar teste grátis
                  </Button>
                </Link>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-hero py-20 md:py-28">
        <div className="container text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl"
          >
            Pronto para modernizar suas licitações?
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="mx-auto mt-4 max-w-xl text-primary-foreground/70"
          >
            Junte-se a gestores públicos e empresas que já utilizam a Intelicite
            para garantir conformidade e agilidade.
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="mt-8"
          >
            <Link to="/signup">
              <Button variant="gold" size="lg" className="text-base px-10 py-6">
                Começar agora — é grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <img src={logoWhite} alt="Intelicite" className="h-6" style={{ filter: "brightness(0) saturate(100%) invert(18%) sepia(68%) saturate(1200%) hue-rotate(190deg)" }} />
              <span className="font-bold">Intelicite</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">LGPD</a>
              <a href="#" className="hover:text-foreground transition-colors">Contato</a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Intelicite. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
