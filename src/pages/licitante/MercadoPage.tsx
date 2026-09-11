import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Search, Loader2, AlertTriangle, RefreshCw,
  Building2, Users, Wallet, FileText, Trophy, Landmark,
} from "lucide-react";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const PERIODOS = [{ v: 7, label: "7 dias" }, { v: 15, label: "15 dias" }, { v: 30, label: "30 dias" }, { v: 90, label: "90 dias" }];

interface Grupo { nome: string; count: number; valor: number; }
interface Mercado {
  resumo: { contratos: number; valorTotal: number; ticketMedio: number; orgaosUnicos: number; fornecedoresUnicos: number; };
  porUF: Grupo[];
  porCategoria: Grupo[];
  topOrgaos: Grupo[];
  topFornecedores: Grupo[];
  janela: { dias: number };
  geradoEm: string;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

function fmtCompacto(v: number): string {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1).replace(".", ",")} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`;
  return fmtBRL(v);
}

function BarList({ dados, titulo, icon: Icon }: { dados: Grupo[]; titulo: string; icon: React.ElementType }) {
  const max = Math.max(...dados.map((d) => d.valor), 1);
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-4">
        <Icon className="w-4 h-4 text-primary" /> {titulo}
      </p>
      {dados.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período.</p>
      ) : (
        <div className="space-y-3">
          {dados.map((d, i) => (
            <div key={d.nome + i}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-card-foreground truncate flex-1" title={d.nome}>
                  <span className="text-muted-foreground mr-1.5">{i + 1}.</span>{d.nome}
                </span>
                <span className="text-xs font-semibold text-card-foreground flex-shrink-0">{fmtCompacto(d.valor)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(d.valor / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="h-full bg-primary rounded-full" />
              </div>
              <span className="text-[10px] text-muted-foreground">{d.count} contrato(s)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MercadoPage() {
  const [data, setData] = useState<Mercado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [dias, setDias] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ dias: String(dias) });
      if (uf) params.set("uf", uf);
      if (q.trim()) params.set("q", q.trim());
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-inteligencia?${params}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erro ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || "Falha ao carregar inteligência de mercado");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias, uf]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchData(); };

  const kpis = data ? [
    { label: "Contratos (amostra)",   value: data.resumo.contratos.toLocaleString("pt-BR"),      icon: FileText },
    { label: "Valor movimentado",     value: fmtCompacto(data.resumo.valorTotal),                icon: Wallet   },
    { label: "Ticket médio",          value: fmtCompacto(data.resumo.ticketMedio),               icon: TrendingUp },
    { label: "Órgãos compradores",    value: data.resumo.orgaosUnicos.toLocaleString("pt-BR"),   icon: Landmark },
    { label: "Fornecedores ativos",   value: data.resumo.fornecedoresUnicos.toLocaleString("pt-BR"), icon: Users },
  ] : [];

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" /> Inteligência de Mercado
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quem compra, o que compram e quem vence — panorama dos contratos públicos recentes.
              {data && (
                <span className="ml-2 text-xs text-muted-foreground/60">
                  · últimos {data.janela.dias} dias · atualizado {new Date(data.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Controles */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-card flex flex-col lg:flex-row gap-3 lg:items-end">
          <form onSubmit={handleSearch} className="flex-1 flex items-end gap-2">
            <div className="flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Segmento / palavra-chave</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Ex.: informática, saúde, obras..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <Button type="submit" size="icon"><Search className="w-4 h-4" /></Button>
          </form>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Estado</p>
            <select value={uf} onChange={(e) => setUf(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[130px]">
              {UFS.map((u) => <option key={u} value={u}>{u || "Todos os estados"}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Período</p>
            <div className="flex gap-1.5">
              {PERIODOS.map((p) => (
                <button key={p.v} onClick={() => setDias(p.v)}
                  className={`text-xs px-3 py-2 rounded-md border transition-colors ${
                    dias === p.v ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Não foi possível carregar os dados</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Agregando contratos do PNCP...</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {kpis.map((k, i) => (
                <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }} className="bg-card rounded-xl border border-border p-4 shadow-card">
                  <k.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-xl font-bold text-card-foreground leading-tight">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{k.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Gráfico por UF + categorias */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-4">
                  <Building2 className="w-4 h-4 text-primary" /> Valor contratado por estado
                </p>
                {data.porUF.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">Sem dados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.porUF.map((d) => ({ uf: d.nome, valor: d.valor }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="uf" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={(v) => fmtCompacto(v).replace("R$ ", "")} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={50} />
                      <Tooltip formatter={(v: number) => [fmtBRL(v), "Valor"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <BarList dados={data.porCategoria} titulo="Por categoria de compra" icon={FileText} />
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarList dados={data.topOrgaos} titulo="Órgãos que mais contratam" icon={Landmark} />
              <BarList dados={data.topFornecedores} titulo="Concorrentes que mais vencem" icon={Trophy} />
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Amostra dos contratos mais recentes do{" "}
          <a href="https://pncp.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Portal Nacional de Contratações Públicas (PNCP)
          </a>{" "}· Lei 14.133/2021
        </p>
      </div>
    </LicitanteLayout>
  );
}
