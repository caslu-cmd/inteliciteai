import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { useRef, useEffect, useState } from "react";
import { useParallax } from "@/hooks/useParallax";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function StaticPrice({ value, prefix = "R$ " }: { value: number; prefix?: string }) {
  return (
    <span className="text-4xl font-extrabold tracking-tight">
      {prefix}{value}
    </span>
  );
}

const plans = [
  {
    name: "Gratuito",
    priceValue: 0,
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
    priceValue: 297,
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

function MetricsBar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const metrics = [
    { value: 500, suffix: "+", label: "Usuários ativos" },
    { value: 10000, suffix: "+", label: "Documentos gerados" },
    { value: 98, suffix: "%", label: "Satisfação" },
    { value: 75, suffix: "%", label: "Economia de tempo" },
  ];

  return (
    <div ref={containerRef} className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="flex flex-col items-center gap-1 rounded-xl glass-card p-5 text-center"
        >
          <span className="text-3xl font-extrabold text-gradient-cyan-purple md:text-4xl">
            {visible ? <CountUpSpan end={m.value} /> : "0"}{m.suffix}
          </span>
          <span className="text-xs text-landing-text-muted">{m.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function CountUpSpan({ end }: { end: number }) {
  const { count, ref } = useCountUp(end, 1500);
  return <span ref={ref as React.Ref<HTMLSpanElement>}>{count.toLocaleString("pt-BR")}</span>;
}

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
              className={`relative rounded-2xl border p-6 sm:p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-accent bg-card shadow-xl shadow-accent/10 md:scale-[1.03]"
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
                <StaticPrice value={plan.priceValue} />
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <Link to="/signup" className="mt-6 block">
                <Button
                  variant={plan.highlighted ? "gold" : "default"}
                  className="w-full h-13 text-base font-semibold"
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

        {/* Metrics */}
        <MetricsBar />
      </div>
    </section>
  );
}
