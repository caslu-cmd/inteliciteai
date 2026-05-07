import { useState, useEffect, useRef } from "react";
  import { motion, useInView, useScroll, useTransform } from "framer-motion";
  import { Link } from "react-router-dom";
  import {
    ArrowRight, CheckCircle2, Menu, X, Zap, Shield, FileText,
    Search, TrendingUp, Users, Scale, DollarSign, BookOpen,
    Star, ChevronRight, Building2, Briefcase, ClipboardList,
    BarChart3, MessageSquare, Lock, Globe, Cpu, Award,
    FileSearch, Handshake, CreditCard, AlertTriangle,
  } from "lucide-react";

  const cn = (...classes: (string | boolean | undefined)[]) =>
    classes.filter(Boolean).join(" ");

  function useScrolled(threshold = 20) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
      const fn = () => setScrolled(window.scrollY > threshold);
      window.addEventListener("scroll", fn, { passive: true });
      return () => window.removeEventListener("scroll", fn);
    }, [threshold]);
    return scrolled;
  }

  function AnimatedSection({
    children,
    className,
    delay = 0,
  }: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
      if (!inView) return;
      const dur = 2000;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / dur, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [inView, target]);
    return (
      <span ref={ref}>
        {count.toLocaleString("pt-BR")}
        {suffix}
      </span>
    );
  }

  const VERTICALS = [
    {
      id: "intelicite",
      name: "Intelicite",
      role: "Gestores Públicos",
      tagline: "A plataforma completa para conduzir licitações em conformidade com a Nova Lei.",
      color: "cyan",
      colorHsl: "190 95% 50%",
      href: "/signup",
      ctaLabel: "Acessar plataforma",
      icon: Building2,
      badge: "Lei 14.133/2021",
      features: [
        { icon: FileText, label: "Gerador de ETP", desc: "Estudo Técnico Preliminar automatizado por IA" },
        { icon: ClipboardList, label: "Gerador de TR", desc: "Termo de Referência completo e revisado" },
        { icon: CheckCircle2, label: "Checklist Inteligente", desc: "Validação de conformidade em tempo real" },
        { icon: BookOpen, label: "Notebook IA", desc: "Análise de documentos com contexto jurídico" },
        { icon: Shield, label: "Validador", desc: "Verificação de minutas e contratos" },
        { icon: DollarSign, label: "Cotação de Preços", desc: "Pesquisa de mercado automatizada" },
      ],
    },
    {
      id: "licitante",
      name: "Licitante",
      role: "Empresas Participantes",
      tagline: "Inteligência competitiva para empresas que querem vencer mais licitações.",
      color: "purple",
      colorHsl: "265 90% 60%",
      href: "https://licitante.intelicite.com.br",
      ctaLabel: "Explorar Licitante",
      icon: Briefcase,
      badge: "IA Competitiva",
      features: [
        { icon: FileSearch, label: "Scanner de Editais", desc: "Análise de risco e pontuação de vitória por IA" },
        { icon: Globe, label: "Radar de Oportunidades", desc: "Monitoramento automático de oportunidades" },
        { icon: BarChart3, label: "Análise Competitiva", desc: "Inteligência sobre concorrentes e mercado" },
        { icon: Award, label: "Habilitação", desc: "Gestão de documentos e requisitos de habilitação" },
        { icon: DollarSign, label: "Precificação IA", desc: "Estratégia de preço para maximizar competitividade" },
        { icon: FileText, label: "Minutas e Contratos", desc: "Templates jurídicos prontos para uso" },
      ],
    },
    {
      id: "consultor",
      name: "Consultor",
      role: "Especialistas em Licitações",
      tagline: "Marketplace que conecta empresas licitantes a consultores certificados.",
      color: "amber",
      colorHsl: "38 95% 58%",
      href: "https://consultor.intelicite.com.br",
      ctaLabel: "Explorar Consultor",
      icon: Handshake,
      badge: "Marketplace",
      features: [
        { icon: ClipboardList, label: "Publicar Projetos", desc: "Empresas publicam demandas e recebem propostas" },
        { icon: Users, label: "Rede de Especialistas", desc: "Consultores certificados em licitações públicas" },
        { icon: CreditCard, label: "Escrow Seguro", desc: "Pagamento protegido e liberado por etapas" },
        { icon: MessageSquare, label: "Chat Integrado", desc: "Comunicação direta no ambiente da plataforma" },
        { icon: AlertTriangle, label: "Resolução de Disputas", desc: "Mediação estruturada para conflitos" },
        { icon: BarChart3, label: "Reputação e Avaliações", desc: "Sistema de avaliação transparente" },
      ],
    },
  ];

  const STATS = [
    { label: "Gestores ativos", value: 2847, suffix: "" },
    { label: "Licitações analisadas", value: 12340, suffix: "" },
    { label: "Em contratos gerenciados", value: 4, suffix: "B+" },
    { label: "Satisfação média", value: 98, suffix: "%" },
  ];

  const verticalStyles = {
    cyan: {
      text: "text-cyan-400",
      border: "border-cyan-400/20",
      bg: "bg-cyan-400/5",
      glow: "shadow-[0_0_40px_-8px_hsl(190_95%_50%/0.4)]",
      gradient: "from-cyan-400 to-cyan-300",
      badgeBg: "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20",
      button: "bg-cyan-400 hover:bg-cyan-300 text-[#080D14]",
      buttonOutline: "border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10",
    },
    purple: {
      text: "text-violet-400",
      border: "border-violet-400/20",
      bg: "bg-violet-400/5",
      glow: "shadow-[0_0_40px_-8px_hsl(265_90%_60%/0.4)]",
      gradient: "from-violet-400 to-violet-300",
      badgeBg: "bg-violet-400/10 text-violet-400 border border-violet-400/20",
      button: "bg-violet-500 hover:bg-violet-400 text-white",
      buttonOutline: "border-violet-400/40 text-violet-400 hover:bg-violet-400/10",
    },
    amber: {
      text: "text-amber-400",
      border: "border-amber-400/20",
      bg: "bg-amber-400/5",
      glow: "shadow-[0_0_40px_-8px_hsl(38_95%_58%/0.4)]",
      gradient: "from-amber-400 to-amber-300",
      badgeBg: "bg-amber-400/10 text-amber-400 border border-amber-400/20",
      button: "bg-amber-400 hover:bg-amber-300 text-[#080D14]",
      buttonOutline: "border-amber-400/40 text-amber-400 hover:bg-amber-400/10",
    },
  };

  function Navbar() {
    const scrolled = useScrolled();
    const [open, setOpen] = useState(false);

    return (
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "bg-[#080D14]/80 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center
  justify-center">
              <Scale className="w-4 h-4 text-[#080D14]" />
            </div>
            <span className="font-futuristic text-sm font-bold tracking-widest text-white uppercase">
              Intelicite
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {["Plataforma", "Soluções", "Preços"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm text-white/60 hover:text-white px-4 py-2 transition-colors">
              Entrar
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium bg-cyan-400 hover:bg-cyan-300 text-[#080D14] px-5 py-2 rounded-lg
  transition-all duration-200 shadow-[0_0_20px_-4px_hsl(190_95%_50%/0.5)]"
            >
              Começar grátis
            </Link>
          </div>

          <button className="md:hidden text-white/60 hover:text-white" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#080D14]/95 backdrop-blur-xl border-b border-white/[0.06] px-6 py-6 flex flex-col
  gap-4"
          >
            {["Plataforma", "Soluções", "Preços"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-white/60 hover:text-white"
  onClick={() => setOpen(false)}>
                {item}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
              <Link to="/login" className="text-sm text-white/60 py-2">Entrar</Link>
              <Link to="/signup" className="text-sm font-medium text-center bg-cyan-400 text-[#080D14] px-5 py-2.5
  rounded-lg">
                Começar grátis
              </Link>
            </div>
          </motion.div>
        )}
      </header>
    );
  }

  function Hero() {
    return (
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute top-[30%] right-[5%] w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[120px]"
  />
          <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-amber-500/8 blur-[100px]"
   />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: `linear-gradient(hsl(190 95% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(190
  95% 50%) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/20
  bg-cyan-400/5 text-cyan-400 text-xs font-medium tracking-widest uppercase mb-8">
              <Zap className="w-3 h-3" />
              Ecossistema de Licitações Públicas
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
          >
            O ecossistema{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(190 95% 50%) 0%, hsl(265 90% 60%) 50%, hsl(190 95%
  50%) 100%)" }}
            >
              completo
            </span>
            <br />de licitações do Brasil
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/45 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Três plataformas especializadas integradas numa única visão: modernizar e profissionalizar
            as compras públicas brasileiras com inteligência artificial.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-16"
          >
            {VERTICALS.map((v) => {
              const s = verticalStyles[v.color as keyof typeof verticalStyles];
              return (
                <a
                  key={v.id}
                  href={`#${v.id}`}
                  className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium
  transition-all duration-200", s.buttonOutline)}
                >
                  <v.icon className="w-4 h-4" />
                  {v.name}
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </a>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/signup"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300
  text-[#080D14] font-semibold text-sm transition-all duration-200 shadow-[0_0_30px_-6px_hsl(190_95%_50%/0.6)]"
            >
              Começar gratuitamente
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="px-8 py-3.5 rounded-xl border border-white/10 text-white/70 hover:text-white
  hover:border-white/20 text-sm font-medium transition-all duration-200"
            >
              Já tenho uma conta
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 flex items-center justify-center gap-6 text-white/30 text-xs"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {["C", "M", "A", "R", "L"].map((l, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border border-[#0B0E14] bg-gradient-to-br
  from-cyan-500/40 to-violet-500/40 flex items-center justify-center text-[9px] text-white font-medium">
                    {l}
                  </div>
                ))}
              </div>
              <span>+2.847 gestores ativos</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
              <span className="ml-1">4.9/5</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-white/20 text-xs tracking-widest uppercase">Explorar</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent"
          />
        </motion.div>
      </section>
    );
  }

  function VerticalsOverview() {
    return (
      <section id="plataforma" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <p className="text-xs font-medium tracking-widest text-white/30 uppercase mb-4">
              Três vertentes. Uma plataforma.
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold text-white tracking-tight"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Escolha sua posição no{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(190
   95% 50%), hsl(265 90% 60%))" }}>
                ecossistema
              </span>
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {VERTICALS.map((v, i) => {
              const s = verticalStyles[v.color as keyof typeof verticalStyles];
              return (
                <AnimatedSection key={v.id} delay={i * 0.1}>
                  <div className={cn("relative group rounded-2xl border p-8 transition-all duration-300
  hover:-translate-y-1", s.border, s.bg)}>
                    <div className={cn("absolute top-0 left-8 right-8 h-px bg-gradient-to-r opacity-60", s.gradient)} />
                    <div className={cn("inline-flex px-3 py-1 rounded-full text-xs font-medium mb-6",
  s.badgeBg)}>{v.badge}</div>
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", s.bg, "border",
  s.border)}>
                      <v.icon className={cn("w-6 h-6", s.text)} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk', system-ui,
   sans-serif" }}>
                      {v.name}
                    </h3>
                    <p className={cn("text-xs font-medium mb-4", s.text)}>{v.role}</p>
                    <p className="text-sm text-white/50 leading-relaxed mb-8">{v.tagline}</p>
                    <ul className="space-y-3 mb-8">
                      {v.features.slice(0, 4).map((f) => (
                        <li key={f.label} className="flex items-center gap-3 text-sm text-white/60">
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gradient-to-r", s.gradient)} />
                          {f.label}
                        </li>
                      ))}
                      <li className="text-xs text-white/30">+{v.features.length - 4} funcionalidades</li>
                    </ul>
                    <a
                      href={v.id === "intelicite" ? "/signup" : `#${v.id}`}
                      className={cn("flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium
  transition-all duration-200", s.button)}
                    >
                      {v.ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  function VerticalSection({ vertical }: { vertical: typeof VERTICALS[0] }) {
    const s = verticalStyles[vertical.color as keyof typeof verticalStyles];
    const isReversed = vertical.id === "licitante";

    return (
      <section id={vertical.id} className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className={cn("grid md:grid-cols-2 gap-16 items-center", isReversed && "md:[&>*:first-child]:order-2")}>
            <AnimatedSection>
              <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6",
  s.badgeBg)}>
                <vertical.icon className="w-3.5 h-3.5" />
                Para {vertical.role}
              </div>
              <h2
                className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-6"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                {vertical.name}
                <br />
                <span className={cn("bg-clip-text text-transparent bg-gradient-to-r", s.gradient)}>
                  {vertical.id === "intelicite" && "Gerencie com inteligência"}
                  {vertical.id === "licitante" && "Vença mais contratos"}
                  {vertical.id === "consultor" && "Monetize sua expertise"}
                </span>
              </h2>
              <p className="text-base text-white/50 leading-relaxed mb-10">{vertical.tagline}</p>
              <a
                href={vertical.id === "intelicite" ? "/signup" : vertical.href}
                className={cn("inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all
  duration-200", s.button)}
              >
                {vertical.ctaLabel}
                <ArrowRight className="w-4 h-4" />
              </a>
            </AnimatedSection>

            <AnimatedSection delay={0.15}>
              <div className="grid grid-cols-2 gap-4">
                {vertical.features.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.07 }}
                    className={cn("rounded-xl border p-5 transition-all duration-200", s.border, "bg-white/[0.02]
  hover:bg-white/[0.04]")}
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", s.bg, "border",
  s.border)}>
                      <f.icon className={cn("w-4 h-4", s.text)} />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{f.label}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    );
  }

  function StatsSection() {
    return (
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-16"
            style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 100%, hsl(190 95% 50% / 0.05),
  transparent)" }}
          >
            <AnimatedSection className="text-center mb-16">
              <p className="text-xs text-white/30 tracking-widest uppercase font-medium mb-3">Números que comprovam</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk',
  system-ui, sans-serif" }}>
                Resultados reais para gestores reais
              </h2>
            </AnimatedSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              {STATS.map((s, i) => (
                <AnimatedSection key={s.label} delay={i * 0.1} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk',
   system-ui, sans-serif" }}>
                    {s.suffix === "B+" ? <>R$<AnimatedCounter target={s.value} />{s.suffix}</> : <><AnimatedCounter
  target={s.value} />{s.suffix}</>}
                  </div>
                  <p className="text-sm text-white/40">{s.label}</p>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const PLANS = [
    {
      name: "Básico",
      price: "Grátis",
      period: "",
      desc: "Para gestores iniciando com a Nova Lei",
      features: ["Gerador de ETP (5/mês)", "Gerador de TR (5/mês)", "Checklist básico", "Suporte por email"],
      cta: "Começar grátis",
      href: "/signup",
      highlight: false,
    },
    {
      name: "Pro",
      price: "R$ 297",
      period: "/mês",
      desc: "Para órgãos com volume moderado de licitações",
      features: ["Geradores ilimitados (ETP, TR)", "Notebook IA completo", "Validador de minutas", "Cotação de preços
  IA", "Diagnóstico de modalidade", "Suporte prioritário"],
      cta: "Começar Pro",
      href: "/signup?plan=pro",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Sob consulta",
      period: "",
      desc: "Para prefeituras e órgãos de grande porte",
      features: ["Tudo do Pro", "Multi-usuário e equipes", "Integração com PNCP", "Relatórios executivos", "SLA
  garantido", "Gerente de conta dedicado"],
      cta: "Falar com vendas",
      href: "mailto:vendas@intelicite.com.br",
      highlight: false,
    },
  ];

  function PricingSection() {
    return (
      <section id="preços" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <p className="text-xs text-white/30 tracking-widest uppercase font-medium mb-4">Planos e preços</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: "'Space
  Grotesk', system-ui, sans-serif" }}>
              Simples de entender,{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(190
   95% 50%), hsl(265 90% 60%))" }}>
                fácil de justificar
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">Cancele quando quiser. Sem fidelidade. Sem taxa de setup.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <AnimatedSection key={plan.name} delay={i * 0.1}>
                <div className={cn("relative rounded-2xl border p-8 h-full flex flex-col transition-all duration-300",
  plan.highlight ? "border-cyan-400/30 bg-cyan-400/5 shadow-[0_0_60px_-12px_hsl(190_95%_50%/0.3)]" :
  "border-white/[0.07] bg-white/[0.02]")}>
                  {plan.highlight && (
                    <>
                      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400
  to-cyan-400/0" />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-400
  text-[#080D14] text-xs font-semibold">Mais popular</div>
                    </>
                  )}
                  <div className="mb-8">
                    <p className="text-sm font-semibold text-white/60 mb-4">{plan.name}</p>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', system-ui,
  sans-serif" }}>{plan.price}</span>
                      {plan.period && <span className="text-white/40 text-sm">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-white/40">{plan.desc}</p>
                  </div>
                  <ul className="space-y-3 mb-10 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm text-white/60">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.href}
                    className={cn("flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
  transition-all duration-200", plan.highlight ? "bg-cyan-400 hover:bg-cyan-300 text-[#080D14]
  shadow-[0_0_20px_-4px_hsl(190_95%_50%/0.5)]" : "border border-white/10 text-white/70 hover:text-white
  hover:border-white/20")}
                  >
                    {plan.cta}
                  </a>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function FinalCTA() {
    return (
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div
              className="relative rounded-3xl overflow-hidden border border-white/[0.06] p-16 text-center"
              style={{ background: "radial-gradient(ellipse 70% 80% at 50% 50%, hsl(190 95% 50% / 0.08) 0%, hsl(265 90%
  60% / 0.04) 50%, transparent 100%), hsl(222 24% 8%)" }}
            >
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-400/30
  to-transparent" />
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/20
  bg-cyan-400/5 text-cyan-400 text-xs font-medium tracking-widest uppercase mb-8">
                <Cpu className="w-3 h-3" />
                Powered by IA
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6" style={{ fontFamily: "'Space
   Grotesk', system-ui, sans-serif" }}>
                Pronto para modernizar<br />suas licitações?
              </h2>
              <p className="text-lg text-white/40 max-w-xl mx-auto mb-12 leading-relaxed">
                Junte-se a milhares de gestores que já profissionalizaram suas compras públicas com o Intelicite.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signup" className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-cyan-400
  hover:bg-cyan-300 text-[#080D14] font-semibold transition-all duration-200
  shadow-[0_0_40px_-8px_hsl(190_95%_50%/0.6)]">
                  Criar conta gratuita
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="mailto:contato@intelicite.com.br" className="flex items-center gap-2 px-8 py-4 rounded-xl
  border border-white/10 text-white/60 hover:text-white hover:border-white/20 font-medium transition-all duration-200">
                  Falar com especialista
                </a>
              </div>
              <p className="mt-8 text-xs text-white/20">Sem necessidade de cartão de crédito · Cancele quando quiser ·
  Dados 100% seguros</p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    );
  }

  function Footer() {
    return (
      <footer className="border-t border-white/[0.05] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center
  justify-center">
                  <Scale className="w-4 h-4 text-[#080D14]" />
                </div>
                <span className="font-futuristic text-sm font-bold tracking-widest text-white
  uppercase">Intelicite</span>
              </div>
              <p className="text-sm text-white/35 leading-relaxed">O ecossistema completo de inteligência para
  licitações públicas do Brasil.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Plataformas</p>
              <ul className="space-y-3">
                {[{ label: "Intelicite — Gestores", href: "/signup" }, { label: "Licitante — Empresas", href:
  "#licitante" }, { label: "Consultor — Especialistas", href: "#consultor" }].map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-white/35 hover:text-white
  transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Recursos</p>
              <ul className="space-y-3">
                {[{ label: "Entrar na plataforma", href: "/login" }, { label: "Criar conta", href: "/signup" }, { label:
   "Preços", href: "#preços" }].map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-white/35 hover:text-white
  transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Legal</p>
              <ul className="space-y-3">
                {[{ label: "Privacidade", href: "#" }, { label: "Termos de uso", href: "#" }, { label: "Contato", href:
  "mailto:contato@intelicite.com.br" }].map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-white/35 hover:text-white
  transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.05] pt-8 flex flex-col md:flex-row items-center justify-between
  gap-4">
            <p className="text-xs text-white/20">© {new Date().getFullYear()} Intelicite. Todos os direitos
  reservados.</p>
            <div className="flex items-center gap-2 text-xs text-white/20">
              <Shield className="w-3 h-3" />
              Conforme Lei 14.133/2021 · LGPD compliant
            </div>
          </div>
        </div>
      </footer>
    );
  }

  export default function LandingPage() {
    return (
      <div className="min-h-screen text-white" style={{ background: "hsl(223 27% 7%)" }}>
        <Navbar />
        <Hero />
        <VerticalsOverview />
        {VERTICALS.map((v) => (
          <VerticalSection key={v.id} vertical={v} />
        ))}
        <StatsSection />
        <PricingSection />
        <FinalCTA />
        <Footer />
      </div>
    );
  }