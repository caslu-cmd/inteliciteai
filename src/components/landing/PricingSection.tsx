import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

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

export default function PricingSection() {
  return (
    <section id="planos" className="relative py-24 md:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/40" />
      <div className="container relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="mx-auto max-w-xl text-center"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            Preços
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Planos para cada{" "}
            <span className="text-gradient-gold">necessidade</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Comece com 7 dias grátis em qualquer plano. Cancele quando quiser.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-3xl gap-6 md:grid-cols-2">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
              className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-accent bg-card shadow-xl shadow-accent/10 scale-[1.03]"
                  : "border-border bg-card hover:shadow-lg hover:shadow-navy/5"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-gold px-5 py-1 text-xs font-bold text-primary-foreground shadow-gold">
                  Mais popular
                </div>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <Link to="/signup" className="mt-6 block">
                <Button
                  variant={plan.highlighted ? "gold" : "default"}
                  className="w-full h-11"
                >
                  Começar teste grátis
                </Button>
              </Link>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2.5 text-sm text-foreground/80"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {feat}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
