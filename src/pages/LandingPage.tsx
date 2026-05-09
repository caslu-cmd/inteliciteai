import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, CheckCircle2, Menu, X, Shield, FileText, Search, TrendingUp,
  Users, Scale, DollarSign, BookOpen, Building2, Briefcase, ClipboardList,
  BarChart3, MessageSquare, Lock, FileSearch, Handshake, CreditCard,
  AlertTriangle, Award, Sparkles, Star,
} from "lucide-react";
import logoWhite from "@/assets/logo-white.png";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

/* ─────────────── Verticals data ─────────────── */
const verticals = [
  {
    id: "intelicite",
    name: "Intelicite",
    tagline: "Para gestores públicos",
    badge: "Lei 14.133/2021",
    color: "cyan",
    accent: "190 95% 50%",
    accent2: "190 95% 65%",
    description:
      "A plataforma definitiva para o Setor Público. Automatize ETPs, Termos de Referência e checklists com inteligência artificial em conformidade total com a Lei nº 14.133/2021.",
    icon: Building2,
    features: [
      { icon: FileText, title: "Gerador de ETP", desc: "Estudos Técnicos Preliminares completos em minutos." },
      { icon: ClipboardList, title: "Gerador de TR", desc: "Termos de Referência com base legal automática." },
      { icon: CheckCircle2, title: "Checklist Inteligente", desc: "Validação ponto a ponto da Lei 14.133." },
      { icon: BookOpen, title: "Notebook IA", desc: "Pesquisa jurídica contextual com fontes." },
      { icon: Shield, title: "Validador de Minutas", desc: "Análise de risco e conformidade de editais." },
      { icon: DollarSign, title: "Cotação de Preços", desc: "Pesquisa de mercado automatizada e auditável." },
    ],
  },
  {
    id: "licitante",
    name: "Licitante",
    tagline: "Para empresas que vendem ao governo",
    badge: "IA Competitiva",
    color: "purple",
    accent: "265 90% 62%",
    accent2: "280 85% 70%",
    description:
      "Inteligência competitiva para empresas que disputam licitações. Encontre oportunidades, analise concorrentes e precifique propostas vencedoras com IA.",
    icon: Briefcase,
    features: [
      { icon: FileSearch, title: "Scanner de Editais", desc: "Análise instantânea de riscos e exigências." },
      { icon: Search, title: "Radar de Oportunidades", desc: "Editais filtrados por CNAE e capacidade." },
      { icon: BarChart3, title: "Análise Competitiva", desc: "Histórico de concorrentes e preços praticados." },
      { icon: Award, title: "Habilitação", desc: "Checklist automático de documentação." },
      { icon: TrendingUp, title: "Precificação IA", desc: "Sugestão de preço ótimo baseada em dados." },
      { icon: FileText, title: "Minutas e Contratos", desc: "Modelos prontos e revisão jurídica IA." },
    ],
  },
  {
    id: "consultor",
    name: "Consultor",
    tagline: "Marketplace de especialistas",
    badge: "Marketplace",
    color: "amber",
    accent: "38 95% 58%",
    accent2: "45 95% 65%",
    description:
      "Conecta pessoas que precisam de consultoria especializada em licitações. Ideal para quem não tem tanto domínio do assunto e quer contar com a orientação de um profissional verificado.",
    icon: Handshake,
    features: [
      { icon: Briefcase, title: "Publicar Projetos", desc: "Receba propostas de especialistas qualificados." },
      { icon: Users, title: "Rede de Especialistas", desc: "Consultores verificados em direito licitatório." },
      { icon: Lock, title: "Escrow Seguro", desc: "Pagamento liberado por entrega aprovada." },
      { icon: MessageSquare, title: "Chat Integrado", desc: "Comunicação centralizada e auditável." },
      { icon: Scale, title: "Resolução de Disputas", desc: "Mediação imparcial integrada à plataforma." },
      { icon: Star, title: "Reputação e Avaliações", desc: "Score público e portfólio verificado." },
    ],
  },
] as const;

/* ─────────────── Helpers ─────────────── */
function useScrolled(threshold = 20) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const fn = () => setS(window.scrollY > threshold);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [threshold]);
  return s;
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let s: number | null = null;
    const dur = 1800;
    const step = (t: number) => {
      if (s === null) s = t;
      const p = Math.min((t - s) / dur, 1);
      setN(Math.floor((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to]);
  return <span ref={ref}>{prefix}{n.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─────────────── Components ─────────────── */
function Navbar() {
  const scrolled = useScrolled(20);
  const [open, setOpen] = useState(false);
  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled ? "backdrop-blur-xl bg-[hsl(223_27%_7%/0.75)] border-b border-white/5" : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={logoWhite} alt="Intelicite" className="h-10 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-9 text-sm text-white/65">
          <a href="#ecossistema" className="hover:text-white transition-colors">Ecossistema</a>
          <a href="#intelicite" className="hover:text-white transition-colors">Gestores</a>
          <a href="#licitante" className="hover:text-white transition-colors">Empresas</a>
          <a href="#consultor" className="hover:text-white transition-colors">Consultores</a>
          <a href="#planos" className="hover:text-white transition-colors">Planos</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-white/70 hover:text-white transition-colors">
            Entrar
          </Link>
          <Link
            to="/signup"
            className="group inline-flex items-center gap-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 transition-colors px-5 h-10 text-sm font-semibold text-black shadow-[0_0_24px_-4px_hsl(190_95%_50%/0.7)]"
          >
            Começar grátis
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-white">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 bg-[hsl(223_27%_7%/0.95)] backdrop-blur-xl">
          <div className="px-6 py-5 flex flex-col gap-4 text-sm text-white/75">
            <a href="#intelicite" onClick={() => setOpen(false)}>Gestores</a>
            <a href="#licitante" onClick={() => setOpen(false)}>Empresas</a>
            <a href="#consultor" onClick={() => setOpen(false)}>Consultores</a>
            <a href="#planos" onClick={() => setOpen(false)}>Planos</a>
            <Link to="/login" className="text-white">Entrar</Link>
            <Link to="/signup" className="rounded-full bg-cyan-400 text-black font-semibold py-2.5 text-center">
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-44 pb-32 overflow-hidden">
      {/* Animated orbs */}
      <motion.div
        animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-20 left-[8%] w-[520px] h-[520px] rounded-full bg-cyan-500/15 blur-[140px]"
      />
      <motion.div
        animate={{ x: [0, -50, 0], y: [0, 50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-32 right-[5%] w-[560px] h-[560px] rounded-full bg-violet-600/15 blur-[140px]"
      />
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 left-1/3 w-[420px] h-[420px] rounded-full bg-amber-500/10 blur-[140px]"
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-1.5 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Ecossistema completo de licitações com IA
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h1 className="mt-8 mx-auto max-w-5xl font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.02] tracking-tight">
            <span className="text-white">A inteligência que</span>{" "}
            <span className="bg-clip-text text-transparent bg-[linear-gradient(110deg,hsl(210_95%_60%),hsl(230_90%_65%))]">
              une todo o ciclo
            </span>{" "}
            <span className="text-white">de licitações.</span>
          </h1>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-7 mx-auto max-w-2xl text-base md:text-lg text-white/55 leading-relaxed">
            Três plataformas, um ecossistema. Para gestores públicos, empresas que vendem ao governo
            e consultores especializados — conectados por IA em conformidade com a Lei 14.133/2021.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-7 h-13 text-sm font-semibold hover:bg-white/90 transition-all shadow-[0_0_40px_-8px_rgba(255,255,255,0.4)] py-3.5"
            >
              Começar grátis por 7 dias
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#ecossistema"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.06] px-7 py-3.5 text-sm font-medium text-white transition-all"
            >
              Conhecer o ecossistema
            </a>
          </div>
        </Reveal>

        {/* Vertical badges */}
        <Reveal delay={0.45}>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {verticals.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="group flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.025] backdrop-blur-md hover:bg-white/[0.06] hover:border-white/20 transition-all px-4 py-2"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: `hsl(${v.accent})`, boxShadow: `0 0 12px hsl(${v.accent} / 0.8)` }}
                />
                <span className="text-sm font-medium text-white/80 group-hover:text-white">{v.name}</span>
                <span className="text-xs text-white/40">{v.tagline}</span>
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function EcosystemCards() {
  return (
    <section id="ecossistema" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
              O ecossistema
            </p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
              Três plataformas.<br />
              <span className="text-white/40">Um único ciclo.</span>
            </h2>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {verticals.map((v, i) => {
            const Icon = v.icon;
            return (
              <Reveal key={v.id} delay={i * 0.1}>
                <a
                  href={`#${v.id}`}
                  className="group block relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-8 h-full hover:border-white/20 transition-all duration-500"
                >
                  <div
                    className="absolute -top-32 -right-32 h-64 w-64 rounded-full opacity-30 group-hover:opacity-60 blur-3xl transition-opacity duration-500"
                    style={{ background: `hsl(${v.accent})` }}
                  />
                  <div className="relative">
                    <div
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10"
                      style={{ background: `hsl(${v.accent} / 0.12)`, color: `hsl(${v.accent2})` }}
                    >
                      <Icon className="h-5.5 w-5.5" />
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-white">{v.name}</h3>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border"
                        style={{
                          color: `hsl(${v.accent2})`,
                          borderColor: `hsl(${v.accent} / 0.3)`,
                          background: `hsl(${v.accent} / 0.08)`,
                        }}
                      >
                        {v.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/50">{v.tagline}</p>
                    <p className="mt-5 text-sm text-white/65 leading-relaxed">{v.description}</p>
                    <div
                      className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all"
                      style={{ color: `hsl(${v.accent2})` }}
                    >
                      Explorar
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VerticalSection({ v, index }: { v: typeof verticals[number]; index: number }) {
  const reverse = index % 2 === 1;
  const Icon = v.icon;
  return (
    <section id={v.id} className="relative py-28 overflow-hidden">
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full blur-[160px] opacity-25 pointer-events-none"
        style={{
          background: `hsl(${v.accent})`,
          [reverse ? "right" : "left"]: "-15%",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className={cn("grid gap-12 lg:gap-16 lg:grid-cols-12 items-start", reverse && "lg:[direction:rtl]")}>
          {/* Sticky intro */}
          <div className="lg:col-span-4 lg:[direction:ltr]">
            <Reveal>
              <div className="lg:sticky lg:top-32">
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    color: `hsl(${v.accent2})`,
                    borderColor: `hsl(${v.accent} / 0.3)`,
                    background: `hsl(${v.accent} / 0.08)`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {v.badge}
                </div>
                <h2 className="mt-6 font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
                  {v.name}
                </h2>
                <p className="mt-2 text-sm font-medium" style={{ color: `hsl(${v.accent2})` }}>
                  {v.tagline}
                </p>
                <p className="mt-6 text-base text-white/60 leading-relaxed">{v.description}</p>
                <Link
                  to="/signup"
                  className="mt-8 inline-flex items-center gap-2 rounded-full px-5 h-11 text-sm font-semibold text-black transition-all hover:opacity-90"
                  style={{
                    background: `hsl(${v.accent})`,
                    boxShadow: `0 0 28px -6px hsl(${v.accent} / 0.6)`,
                  }}
                >
                  Acessar {v.name}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Features grid */}
          <div className="lg:col-span-8 lg:[direction:ltr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {v.features.map((f, i) => {
                const FIcon = f.icon;
                return (
                  <Reveal key={f.title} delay={i * 0.05}>
                    <div className="group relative h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/15 transition-all">
                      <div
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 transition-transform group-hover:scale-110"
                        style={{ background: `hsl(${v.accent} / 0.1)`, color: `hsl(${v.accent2})` }}
                      >
                        <FIcon className="h-4.5 w-4.5" />
                      </div>
                      <h4 className="mt-5 font-display text-lg font-semibold text-white">{f.title}</h4>
                      <p className="mt-1.5 text-sm text-white/55 leading-relaxed">{f.desc}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  const stats = [
    { value: 8, label: "Bilhões em gastos irregulares evitados pelos TCEs com IA (1º sem/2025)", prefix: "R$ ", suffix: "B" },
    { value: 3400, label: "Licitações analisadas pela IA do TCE/SC só no 1º trimestre de 2025" },
    { value: 2, label: "Bilhões economizados pelo TCDF em análises de licitações com IA", prefix: "R$ ", suffix: "B+" },
    { value: 70, label: "Redução média de tempo na elaboração de ETPs e TRs com IA", suffix: "%" },
  ];
  return (
    <section className="relative py-20 border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Impacto real</p>
          <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
            A IA já está transformando as licitações públicas no Brasil.
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div>
                <div className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
                  <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div className="mt-3 text-sm text-white/55 leading-relaxed">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-10 text-xs text-white/35">
          Fontes: TCE/SC, TCDF, TCE-MG e estudos de produtividade de IA aplicada a contratações públicas (2024–2025).
        </p>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Básico",
      price: "Grátis",
      period: "7 dias de teste",
      desc: "Para conhecer toda a plataforma sem compromisso.",
      features: ["Acesso completo por 7 dias", "Todas as ferramentas IA", "Sem cartão de crédito", "Suporte por email"],
      cta: "Começar grátis",
      href: "/signup",
      external: false,
      highlight: false,
    },
    {
      name: "Pro",
      price: "R$ 297",
      period: "/mês",
      desc: "Acesso ilimitado a todas as ferramentas do ecossistema.",
      features: [
        "Tudo do Básico",
        "Uso ilimitado de IA",
        "Validador de Editais avançado",
        "Notebook IA com fontes",
        "Exportação PDF e Word",
        "Suporte prioritário",
      ],
      cta: "Assinar Pro",
      href: "/signup",
      external: false,
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Sob consulta",
      period: "",
      desc: "Para órgãos, secretarias e grandes empresas.",
      features: [
        "Tudo do Pro",
        "Multi-usuário e SSO",
        "API e integrações",
        "Treinamento dedicado",
        "SLA contratual",
        "Gestor de conta",
      ],
      cta: "Falar com vendas",
      href: "/signup",
      external: false,
      highlight: false,
    },
  ];
  return (
    <section id="planos" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Planos</p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold tracking-tight text-white">
              Preços simples,<br />
              <span className="text-white/40">sem surpresas.</span>
            </h2>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1}>
              <div
                className={cn(
                  "relative h-full rounded-3xl border p-8 flex flex-col",
                  p.highlight
                    ? "border-cyan-400/40 bg-gradient-to-b from-cyan-500/[0.08] to-transparent shadow-[0_0_60px_-20px_hsl(190_95%_50%/0.4)]"
                    : "border-white/[0.07] bg-white/[0.02]"
                )}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-8 rounded-full bg-cyan-400 text-black text-[11px] font-bold uppercase tracking-wider px-3 py-1">
                    Mais popular
                  </div>
                )}
                <h3 className="font-display text-xl font-bold text-white">{p.name}</h3>
                <p className="mt-2 text-sm text-white/50 min-h-[40px]">{p.desc}</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold text-white">{p.price}</span>
                  {p.period && <span className="text-sm text-white/45">{p.period}</span>}
                </div>
                {p.external ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "mt-7 inline-flex items-center justify-center rounded-full px-5 h-12 text-sm font-semibold transition-all",
                      p.highlight
                        ? "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_28px_-6px_hsl(190_95%_50%/0.6)]"
                        : "border border-white/15 text-white hover:bg-white/[0.06]"
                    )}
                  >
                    {p.cta}
                  </a>
                ) : (
                  <Link
                    to={p.href}
                    className={cn(
                      "mt-7 inline-flex items-center justify-center rounded-full px-5 h-12 text-sm font-semibold transition-all",
                      p.highlight
                        ? "bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_28px_-6px_hsl(190_95%_50%/0.6)]"
                        : "border border-white/15 text-white hover:bg-white/[0.06]"
                    )}
                  >
                    {p.cta}
                  </Link>
                )}
                <ul className="mt-8 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-xl p-12 md:p-20 text-center">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-500/20 blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-amber-500/10 blur-[120px]" />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl font-display text-4xl md:text-6xl font-bold tracking-tight text-white">
                Pronto para entrar no{" "}
                <span className="bg-clip-text text-transparent bg-[linear-gradient(110deg,hsl(190_95%_60%),hsl(265_90%_70%))]">
                  futuro das licitações
                </span>
                ?
              </h2>
              <p className="mt-6 mx-auto max-w-xl text-base text-white/60">
                Junte-se a milhares de gestores, empresas e consultores que já transformaram o ciclo licitatório com IA.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-7 h-13 py-3.5 text-sm font-semibold hover:bg-white/90 transition-all"
                >
                  Começar grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition-all"
                >
                  Já tenho conta
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: "Plataformas",
      links: [
        { label: "Intelicite (Gestores)", href: "#intelicite" },
        { label: "Licitante (Empresas)", href: "#licitante" },
        { label: "Consultor (Marketplace)", href: "#consultor" },
      ],
    },
    {
      title: "Recursos",
      links: [
        { label: "Lei 14.133/2021", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Central de ajuda", href: "#" },
        { label: "API", href: "#" },
      ],
    },
    {
      title: "Empresa",
      links: [
        { label: "Sobre", href: "#" },
        { label: "Carreiras", href: "#" },
        { label: "Contato", href: "#" },
        { label: "Imprensa", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Termos de Uso", href: "#" },
        { label: "Privacidade", href: "#" },
        { label: "LGPD", href: "#" },
        { label: "Segurança", href: "#" },
      ],
    },
  ];
  return (
    <footer className="relative border-t border-white/[0.06] py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <div className="flex items-center">
              <img src={logoWhite} alt="Intelicite" className="h-9 w-auto" />
            </div>
            <p className="mt-5 text-sm text-white/50 max-w-xs leading-relaxed">
              O ecossistema completo de licitações com inteligência artificial.
              Conformidade total com a Lei 14.133/2021.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white">{c.title}</h4>
              <ul className="mt-5 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-white/55 hover:text-white transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Intelicite. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/40">Feito no Brasil para o Setor Público.</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── Page ─────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[hsl(223_27%_7%)] text-white antialiased overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <EcosystemCards />
        {verticals.map((v, i) => (
          <VerticalSection key={v.id} v={v} index={i} />
        ))}
        <StatsBar />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
