import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarClock, Search, Loader2, AlertTriangle, RefreshCw,
  Building2, MapPin, ExternalLink, Trophy, DollarSign, Timer,
} from "lucide-react";

const UFS = ["", "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const HORIZONTES = [
  { v: 30,  label: "30 dias"  },
  { v: 60,  label: "60 dias"  },
  { v: 90,  label: "90 dias"  },
  { v: 180, label: "6 meses"  },
];

interface Contrato {
  id: string;
  objeto: string;
  orgao: string;
  unidade: string;
  uf: string;
  municipio: string;
  fornecedor: string;
  valor: number;
  valorFmt: string;
  dataVigenciaFim: string | null;
  diasRestantes: number | null;
  tipo: string;
  link: string;
}

interface Resposta {
  contratos: Contrato[];
  total: number;
  varridos: number;
  horizonte: number;
  geradoEm: string;
}

function urgencia(dias: number | null): { label: string; cls: string } {
  if (dias === null) return { label: "—", cls: "bg-muted text-muted-foreground border-border" };
  if (dias <= 15) return { label: `${dias}d`, cls: "bg-destructive/10 text-destructive border-destructive/25" };
  if (dias <= 45) return { label: `${dias}d`, cls: "bg-amber-400/10 text-amber-500 border-amber-400/25" };
  return { label: `${dias}d`, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" };
}

export default function RenovacoesPage() {
  const [data, setData] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [horizonte, setHorizonte] = useState(90);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ horizonte: String(horizonte) });
      if (uf) params.set("uf", uf);
      if (q.trim()) params.set("q", q.trim());

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contratos-vencendo?${params}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Erro ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || "Falha ao carregar contratos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonte, uf]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchData(); };

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-primary" /> Radar de Renovações
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Contratos públicos com vigência acabando — antecipe-se à nova licitação e saiba quem é o fornecedor atual.
              {data && (
                <span className="ml-2 text-xs text-muted-foreground/60">
                  · {data.total} contratos · atualizado {new Date(data.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Palavra-chave</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Ex.: informática, limpeza, medicamentos..."
                  value={q} onChange={(e) => setQ(e.target.value)} />
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Vencem em até</p>
            <div className="flex gap-1.5">
              {HORIZONTES.map((h) => (
                <button key={h.v} onClick={() => setHorizonte(h.v)}
                  className={`text-xs px-3 py-2 rounded-md border transition-colors ${
                    horizonte === h.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                  }`}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Não foi possível carregar os contratos</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Buscando contratos a vencer no PNCP...</p>
          </div>
        )}

        {/* Resultados */}
        {!loading && !error && data && (
          data.contratos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum contrato vencendo nesse período com os filtros atuais.</p>
              <p className="text-xs mt-1">Tente ampliar o prazo (6 meses) ou remover a palavra-chave.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.contratos.map((c, i) => {
                const u = urgencia(c.diasRestantes);
                const fimFmt = c.dataVigenciaFim
                  ? new Date(c.dataVigenciaFim + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—";
                return (
                  <motion.div key={c.id + i}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${u.cls}`}>
                            <Timer className="w-3 h-3" /> vence em {u.label}
                          </span>
                          {c.tipo && <span className="text-[11px] text-muted-foreground">{c.tipo}</span>}
                        </div>
                        <h3 className="font-semibold text-sm text-card-foreground leading-snug line-clamp-2">{c.objeto}</h3>
                        <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.orgao}</span>
                          {(c.municipio || c.uf) && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[c.municipio, c.uf].filter(Boolean).join(", ")}</span>
                          )}
                          <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />encerra {fimFmt}</span>
                        </div>
                        {c.fornecedor && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 max-w-fit">
                            <Trophy className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-[11px] leading-snug text-primary/90">
                              Fornecedor atual: <strong>{c.fornecedor}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 lg:flex-col lg:items-end lg:text-right">
                        <div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 lg:justify-end">
                            <DollarSign className="w-3 h-3" /> valor
                          </p>
                          <p className="font-semibold text-sm text-card-foreground">{c.valorFmt}</p>
                        </div>
                        <a href={c.link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                            Ver no PNCP <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* Attribution */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Amostra de contratos públicos do{" "}
          <a href="https://pncp.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Portal Nacional de Contratações Públicas (PNCP)
          </a>{" "}· Lei 14.133/2021
        </p>
      </div>
    </LicitanteLayout>
  );
}
