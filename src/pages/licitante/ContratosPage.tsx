import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  FileCheck, Calendar, AlertTriangle, Plus, ChevronRight, Clock, DollarSign,
  Building2, Loader2, Trash2, X,
} from "lucide-react";

interface Contrato {
  id: string;
  numero: string;
  titulo: string;
  orgao: string;
  valor: number;
  data_inicio: string | null;
  data_fim: string | null;
  progresso: number;
  proximo_marco: string;
  proxima_data: string;
  aditivos_pendentes: number;
  created_at: string;
}

type Status = "vigente" | "vencendo" | "encerrado";

const statusConfig: Record<Status, { label: string; class: string }> = {
  vigente:   { label: "Vigente",   class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  vencendo:  { label: "Vencendo",  class: "bg-amber-400/10 text-amber-400 border-amber-400/20"       },
  encerrado: { label: "Encerrado", class: "bg-muted text-muted-foreground border-border"              },
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtCompact = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)}K`
  : fmt(v);

// Status derivado da data de fim / progresso
function getStatus(c: Contrato): Status {
  if (c.progresso >= 100) return "encerrado";
  if (!c.data_fim) return "vigente";
  const dias = Math.ceil((new Date(c.data_fim + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (dias < 0) return "encerrado";
  if (dias <= 30) return "vencendo";
  return "vigente";
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 16, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

const emptyForm = {
  numero: "", titulo: "", orgao: "", valor: "", data_inicio: "", data_fim: "",
  progresso: "0", proximo_marco: "", proxima_data: "", aditivos_pendentes: "0",
};

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contratos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Falha ao carregar contratos");
    setContracts((data as Contrato[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.titulo.trim()) { toast.error("Informe o título do contrato."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Usuário não autenticado"); setSaving(false); return; }
    const { error } = await supabase.from("contratos").insert({
      user_id: user.id,
      numero: form.numero.trim(),
      titulo: form.titulo.trim(),
      orgao: form.orgao.trim(),
      valor: parseFloat(form.valor.replace(/\./g, "").replace(",", ".")) || 0,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      progresso: Math.min(100, Math.max(0, parseInt(form.progresso) || 0)),
      proximo_marco: form.proximo_marco.trim(),
      proxima_data: form.proxima_data.trim(),
      aditivos_pendentes: Math.max(0, parseInt(form.aditivos_pendentes) || 0),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contrato adicionado");
    setForm({ ...emptyForm });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este contrato?")) return;
    const prev = contracts;
    setContracts((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) { toast.error("Falha ao excluir"); setContracts(prev); }
    else toast.success("Contrato excluído");
  };

  const withStatus = contracts.map((c) => ({ ...c, status: getStatus(c) }));
  const vigentes = withStatus.filter((c) => c.status === "vigente").length;
  const valorAtivo = withStatus.filter((c) => c.status !== "encerrado").reduce((s, c) => s + Number(c.valor), 0);
  const vencendo = withStatus.filter((c) => c.status === "vencendo").length;
  const aditivos = contracts.reduce((s, c) => s + (c.aditivos_pendentes || 0), 0);

  const stats = [
    { label: "Contratos Vigentes", value: String(vigentes),        icon: FileCheck,     color: "text-emerald-500" },
    { label: "Valor Total Ativo",  value: fmtCompact(valorAtivo),  icon: DollarSign,    color: "text-primary"     },
    { label: "Vencendo em 30 dias", value: String(vencendo),       icon: Clock,         color: "text-amber-400"   },
    { label: "Aditivos Pendentes", value: String(aditivos),        icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Gestão de Contratos</h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe contratos, aditivos e fiscalizações</p>
          </div>
          <Button className="gap-2 flex-shrink-0" onClick={() => setShowForm((s) => !s)}>
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Contrato</>}
          </Button>
        </motion.div>

        {/* Formulário */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6">
              <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Novo Contrato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Nº do Contrato"><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Ex: CT-2025-001" /></Field>
                  <Field label="Título *" className="lg:col-span-2"><Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Fornecimento de Equipamentos de TI" /></Field>
                  <Field label="Órgão / Contratante"><Input value={form.orgao} onChange={(e) => set("orgao", e.target.value)} placeholder="Ex: Ministério da Saúde" /></Field>
                  <Field label="Valor (R$)"><Input value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="Ex: 2.450.000,00" /></Field>
                  <Field label="Execução (%)"><Input type="number" min={0} max={100} value={form.progresso} onChange={(e) => set("progresso", e.target.value)} /></Field>
                  <Field label="Início"><Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Field>
                  <Field label="Fim da vigência"><Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></Field>
                  <Field label="Aditivos pendentes"><Input type="number" min={0} value={form.aditivos_pendentes} onChange={(e) => set("aditivos_pendentes", e.target.value)} /></Field>
                  <Field label="Próximo marco" className="lg:col-span-2"><Input value={form.proximo_marco} onChange={(e) => set("proximo_marco", e.target.value)} placeholder="Ex: Entrega parcial - Lote 2" /></Field>
                  <Field label="Data do próximo marco"><Input value={form.proxima_data} onChange={(e) => set("proxima_data", e.target.value)} placeholder="Ex: 15/04/2026" /></Field>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button onClick={save} disabled={saving} className="gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Plus className="w-4 h-4" /> Salvar contrato</>}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }}>Cancelar</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPIs */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="bg-card rounded-xl border border-border p-5 shadow-card">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : withStatus.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum contrato cadastrado. Clique em "Novo Contrato" para começar.</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {withStatus.map((contract) => (
              <motion.div key={contract.id} variants={itemVariants}
                className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      {contract.numero && <span className="text-xs font-mono-legal text-muted-foreground">{contract.numero}</span>}
                      <Badge variant="outline" className={statusConfig[contract.status].class}>{statusConfig[contract.status].label}</Badge>
                      {contract.aditivos_pendentes > 0 && (
                        <Badge variant="outline" className="bg-amber-400/10 text-amber-400 border-amber-400/20 text-xs">
                          {contract.aditivos_pendentes} aditivo(s)
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-card-foreground">{contract.titulo}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                      {contract.orgao && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.orgao}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(contract.data_inicio)} → {fmtDate(contract.data_fim)}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmt(Number(contract.valor))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Execução</span>
                        <span className="font-medium text-card-foreground">{contract.progresso}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${contract.progresso}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full rounded-full ${contract.progresso >= 80 ? "bg-amber-400" : "bg-primary"}`} />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      title="Excluir" onClick={() => remove(contract.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {contract.status !== "encerrado" && contract.proximo_marco && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Próximo marco: <span className="text-card-foreground font-medium">{contract.proximo_marco}</span>{contract.proxima_data && ` — ${contract.proxima_data}`}</span>
                  </div>
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
