import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, Calculator, Target, Percent, ArrowRight, AlertTriangle,
  CheckCircle2, Loader2, Trash2, X,
} from "lucide-react";

type Recomendacao = "agressivo" | "moderado" | "conservador";

interface Simulacao {
  id: string;
  titulo: string;
  orgao: string;
  valor_estimado: number;
  custo: number;
  margem_desejada: number;
  num_concorrentes: number;
  preco_sugerido: number;
  margem: number;
  prob_vitoria: number;
  recomendacao: Recomendacao;
  created_at: string;
}

const recColors: Record<Recomendacao, string> = {
  agressivo: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  moderado: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  conservador: "bg-destructive/10 text-destructive border-destructive/20",
};
const recLabels: Record<Recomendacao, string> = {
  agressivo: "Preço agressivo", moderado: "Preço moderado", conservador: "Preço conservador",
};
const recDetails: Record<Recomendacao, string> = {
  agressivo: "Oportunidade com alta chance. Preço agressivo para maximizar a vitória.",
  moderado: "Equilibrar margem e competitividade. Monitorar a concorrência.",
  conservador: "Foco na margem. Alta competição reduz as chances com preço elevado.",
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtCompact = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)}K`
  : fmt(v);
const parseNum = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

// Cálculo determinístico da precificação sugerida.
// - Desconto sobre o valor estimado cresce com a concorrência.
// - Nunca abaixo do custo + 3% (piso de margem).
// - Probabilidade de vitória: maior com desconto mais agressivo e menos concorrentes.
function calcular(valorEstimado: number, custo: number, margemDesejada: number, numConcorrentes: number) {
  const descontoConcorrencia = Math.min(0.28, 0.04 + numConcorrentes * 0.02);
  const precoPorDesconto = valorEstimado * (1 - descontoConcorrencia);
  const precoPorMargem = custo > 0 ? custo * (1 + margemDesejada / 100) : precoPorDesconto;
  const piso = custo > 0 ? custo * 1.03 : 0;
  const precoSugerido = Math.max(piso, Math.min(precoPorDesconto, precoPorMargem || precoPorDesconto));

  const margem = precoSugerido > 0 && custo > 0
    ? ((precoSugerido - custo) / precoSugerido) * 100
    : margemDesejada;

  const descontoReal = valorEstimado > 0 ? (1 - precoSugerido / valorEstimado) * 100 : 0;
  let prob = 55 + descontoReal * 1.6 - numConcorrentes * 4;
  prob = Math.round(Math.min(95, Math.max(20, prob)));

  const recomendacao: Recomendacao = prob >= 65 ? "agressivo" : prob >= 45 ? "moderado" : "conservador";

  return {
    preco_sugerido: Math.round(precoSugerido * 100) / 100,
    margem: Math.round(margem * 10) / 10,
    prob_vitoria: prob,
    recomendacao,
  };
}

const emptyForm = { titulo: "", orgao: "", valor_estimado: "", custo: "", margem_desejada: "15", num_concorrentes: "3" };

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 16, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

export default function PrecificacaoPage() {
  const [sims, setSims] = useState<Simulacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSim, setSelectedSim] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("precificacao_simulacoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Falha ao carregar simulações");
    setSims((data as Simulacao[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const preview = form.valor_estimado
    ? calcular(parseNum(form.valor_estimado), parseNum(form.custo), parseNum(form.margem_desejada), parseInt(form.num_concorrentes) || 0)
    : null;

  const save = async () => {
    if (!form.titulo.trim()) { toast.error("Informe o título da simulação."); return; }
    if (!form.valor_estimado) { toast.error("Informe o valor estimado."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Usuário não autenticado"); setSaving(false); return; }
    const valorEstimado = parseNum(form.valor_estimado);
    const custo = parseNum(form.custo);
    const margemDesejada = parseNum(form.margem_desejada);
    const numConcorrentes = parseInt(form.num_concorrentes) || 0;
    const r = calcular(valorEstimado, custo, margemDesejada, numConcorrentes);

    const { error } = await supabase.from("precificacao_simulacoes").insert({
      user_id: user.id,
      titulo: form.titulo.trim(),
      orgao: form.orgao.trim(),
      valor_estimado: valorEstimado,
      custo,
      margem_desejada: margemDesejada,
      num_concorrentes: numConcorrentes,
      ...r,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Simulação criada");
    setForm({ ...emptyForm });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta simulação?")) return;
    const prev = sims;
    setSims((s) => s.filter((x) => x.id !== id));
    const { error } = await supabase.from("precificacao_simulacoes").delete().eq("id", id);
    if (error) { toast.error("Falha ao excluir"); setSims(prev); }
    else toast.success("Simulação excluída");
  };

  const count = sims.length;
  const margemMedia = count ? sims.reduce((s, x) => s + Number(x.margem), 0) / count : 0;
  const economia = sims.reduce((s, x) => s + Math.max(0, Number(x.valor_estimado) - Number(x.preco_sugerido)), 0);
  const probMedia = count ? Math.round(sims.reduce((s, x) => s + x.prob_vitoria, 0) / count) : 0;

  const stats = [
    { label: "Simulações Realizadas", value: String(count),                 icon: Calculator, color: "text-primary"     },
    { label: "Margem Média",          value: `${margemMedia.toFixed(1)}%`,  icon: Percent,    color: "text-emerald-500" },
    { label: "Economia Potencial",    value: fmtCompact(economia),          icon: DollarSign, color: "text-accent"      },
    { label: "Prob. Média de Vitória", value: `${probMedia}%`,              icon: Target,     color: "text-primary"     },
  ];

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display font-bold text-2xl text-foreground">Precificação Estratégica</h1>
          <p className="text-sm text-muted-foreground mt-1">Simulações de proposta econômica e recomendações táticas</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-6 mb-8 bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-card-foreground">Nova Simulação</h2>
              <p className="text-sm text-muted-foreground mt-1">Insira o valor estimado, custos e margem desejada para receber recomendações de preço.</p>
            </div>
            <Button className="gap-2 flex-shrink-0" onClick={() => setShowForm((s) => !s)}>
              {showForm ? <><X className="w-4 h-4" /> Fechar</> : <><Calculator className="w-4 h-4" /> Criar Simulação</>}
            </Button>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
                  <Field label="Título *" className="lg:col-span-2"><Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: PE 045/2025 - Equipamentos de TI" /></Field>
                  <Field label="Órgão"><Input value={form.orgao} onChange={(e) => set("orgao", e.target.value)} placeholder="Ex: Ministério da Saúde" /></Field>
                  <Field label="Valor estimado (R$) *"><Input value={form.valor_estimado} onChange={(e) => set("valor_estimado", e.target.value)} placeholder="Ex: 2.450.000,00" /></Field>
                  <Field label="Seu custo (R$)"><Input value={form.custo} onChange={(e) => set("custo", e.target.value)} placeholder="Ex: 1.900.000,00" /></Field>
                  <Field label="Margem desejada (%)"><Input type="number" min={0} value={form.margem_desejada} onChange={(e) => set("margem_desejada", e.target.value)} /></Field>
                  <Field label="Nº de concorrentes estimado"><Input type="number" min={0} value={form.num_concorrentes} onChange={(e) => set("num_concorrentes", e.target.value)} /></Field>
                </div>

                {preview && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 rounded-lg p-4">
                    <Metric label="Preço sugerido" value={fmt(preview.preco_sugerido)} highlight />
                    <Metric label="Margem" value={`${preview.margem}%`} />
                    <Metric label="Prob. vitória" value={`${preview.prob_vitoria}%`} />
                    <div className="flex items-center justify-center">
                      <Badge variant="outline" className={recColors[preview.recomendacao]}>{recLabels[preview.recomendacao]}</Badge>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  <Button onClick={save} disabled={saving} className="gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><CheckCircle2 className="w-4 h-4" /> Salvar simulação</>}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }}>Cancelar</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* KPIs */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Lista */}
        <h3 className="font-display font-semibold text-base text-foreground mb-4">Simulações Recentes</h3>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : sims.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calculator className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma simulação ainda. Clique em "Criar Simulação" para começar.</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {sims.map((sim) => (
              <motion.div key={sim.id} variants={itemVariants}
                className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedSim(selectedSim === sim.id ? null : sim.id)}>
                    <h4 className="font-semibold text-card-foreground">{sim.titulo}</h4>
                    {sim.orgao && <p className="text-xs text-muted-foreground mt-1">{sim.orgao}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="text-center"><p className="font-bold text-card-foreground">{fmt(Number(sim.valor_estimado))}</p><p className="text-xs text-muted-foreground">Valor estimado</p></div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <div className="text-center"><p className="font-bold text-emerald-500">{fmt(Number(sim.preco_sugerido))}</p><p className="text-xs text-muted-foreground">Preço sugerido</p></div>
                    <div className="text-center"><p className="font-bold text-card-foreground">{Number(sim.margem)}%</p><p className="text-xs text-muted-foreground">Margem</p></div>
                    <div className="text-center"><p className="font-bold text-card-foreground">{sim.prob_vitoria}%</p><p className="text-xs text-muted-foreground">Prob. vitória</p></div>
                    <Badge variant="outline" className={recColors[sim.recomendacao]}>{recLabels[sim.recomendacao]}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Excluir" onClick={() => remove(sim.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {selectedSim === sim.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-card-foreground">Margem aplicada</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Custo de {fmt(Number(sim.custo))} com margem de {Number(sim.margem)}% sobre o preço sugerido (desejada: {Number(sim.margem_desejada)}%).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-card-foreground">Riscos identificados</p>
                          <p className="text-muted-foreground text-xs mt-1">{sim.num_concorrentes} concorrentes estimados. Quanto maior a disputa, mais pressão sobre o preço.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium text-card-foreground">Recomendação</p>
                          <p className="text-muted-foreground text-xs mt-1">{recDetails[sim.recomendacao]}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </LicitanteLayout>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-bold ${highlight ? "text-emerald-500 text-lg" : "text-card-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
