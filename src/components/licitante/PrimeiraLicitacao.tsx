import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Radar, Gavel, Bell, CheckCircle2, ChevronRight, X, Rocket, GraduationCap } from "lucide-react";

// Onboarding "Sua primeira licitação": guia o usuário novo do zero até analisar
// o primeiro edital. Some sozinho quando concluído ou dispensado.

interface Passo {
  chave: string;
  titulo: string;
  desc: string;
  icon: React.ElementType;
  rota: string;
  feito: boolean;
  // marca no localStorage ao clicar (para passos que não dá para detectar no banco)
  marcarAoClicar?: boolean;
}

export function PrimeiraLicitacao() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [temPerfil, setTemPerfil] = useState(false);
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [locais, setLocais] = useState<{ radar?: boolean; analise?: boolean }>({});
  const [dispensado, setDispensado] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const chaveLS = (uid: string) => `intelicite_onb_${uid}`;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCarregado(true); return; }
      setUserId(user.id);
      try {
        const raw = localStorage.getItem(chaveLS(user.id));
        if (raw) {
          const o = JSON.parse(raw);
          setLocais({ radar: !!o.radar, analise: !!o.analise });
          setDispensado(!!o.dispensado);
        }
      } catch { /* localStorage indisponível */ }

      const { data } = await supabase
        .from("profiles")
        .select("empresa_perfil, alerta_ativo")
        .eq("id", user.id)
        .single();
      setTemPerfil(!!data?.empresa_perfil);
      setAlertaAtivo(!!data?.alerta_ativo);
      setCarregado(true);
    })();
  }, []);

  const salvar = (patch: Record<string, boolean>) => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(chaveLS(userId));
      const atual = raw ? JSON.parse(raw) : {};
      localStorage.setItem(chaveLS(userId), JSON.stringify({ ...atual, ...patch }));
    } catch { /* ignora */ }
  };

  const passos: Passo[] = [
    { chave: "perfil",  titulo: "Cadastre sua empresa pelo CNPJ", desc: "Digite o CNPJ e a Intelicite monta seu perfil com os dados da Receita Federal.", icon: Building2, rota: "/licitante/empresa", feito: temPerfil },
    { chave: "radar",   titulo: "Ache oportunidades",       desc: "Abra o Radar e rode o Match IA nos editais do PNCP.",          icon: Radar,     rota: "/licitante/radar", feito: !!locais.radar, marcarAoClicar: true },
    { chave: "analise", titulo: "Analise um edital",        desc: "Jogue um edital no Parecer IA e veja o veredito com fontes.",  icon: Gavel,     rota: "/licitante/parecer", feito: !!locais.analise, marcarAoClicar: true },
    { chave: "alertas", titulo: "Ative os alertas",         desc: "Receba todo dia os editais compatíveis com você.",             icon: Bell,      rota: "/licitante/radar", feito: alertaAtivo },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  const total = passos.length;
  const concluido = feitos === total;

  // Não renderiza: ainda carregando, dispensado, ou tudo concluído.
  if (!carregado || dispensado || concluido) return null;

  const irPara = (p: Passo) => {
    if (p.marcarAoClicar) {
      setLocais((s) => ({ ...s, [p.chave]: true }));
      salvar({ [p.chave]: true });
    }
    navigate(p.rota);
  };

  const dispensar = () => { setDispensado(true); salvar({ dispensado: true }); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
        className="relative bg-card rounded-2xl border border-primary/20 shadow-card p-5 md:p-6 mb-8 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <button onClick={dispensar} title="Dispensar" aria-label="Dispensar"
          className="absolute top-3 right-3 text-muted-foreground/60 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-lg text-foreground">Sua primeira licitação</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          4 passos rápidos para você tirar o máximo do Intelicite. {feitos} de {total} concluídos.
        </p>

        {/* Barra de progresso */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5">
          <motion.div className="h-full bg-primary rounded-full"
            initial={{ width: 0 }} animate={{ width: `${(feitos / total) * 100}%` }}
            transition={{ duration: 0.5 }} />
        </div>

        {/* Passos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {passos.map((p, i) => (
            <button key={p.chave} onClick={() => irPara(p)} disabled={p.feito}
              className={`text-left flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                p.feito
                  ? "border-emerald-500/25 bg-emerald-500/5 cursor-default"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                p.feito ? "bg-emerald-500/15 text-emerald-600" : "gradient-primary text-white"
              }`}>
                {p.feito ? <CheckCircle2 className="w-4 h-4" /> : <p.icon className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${p.feito ? "text-emerald-700 dark:text-emerald-400 line-through" : "text-card-foreground"}`}>
                  <span className="text-muted-foreground mr-1">{i + 1}.</span>{p.titulo}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
              </div>
              {!p.feito && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>

        <button onClick={() => navigate("/licitante/guia")}
          className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <GraduationCap className="w-3.5 h-3.5" /> Nunca participou de uma licitação? Comece entendendo o básico
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
