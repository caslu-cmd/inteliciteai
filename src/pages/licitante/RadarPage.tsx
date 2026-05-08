import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, SlidersHorizontal, MapPin, Building, Tag, X,
  Radar as RadarIcon, Loader2, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";

// PNCP modalidade IDs
const MODALIDADES = [
  { id: "11", label: "Pregão Eletrônico" },
  { id: "4",  label: "Concorrência" },
  { id: "5",  label: "Concorrência Eletrônica" },
  { id: "7",  label: "Dispensa" },
  { id: "8",  label: "Inexigibilidade" },
];

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface Opportunity {
  id: string;
  title: string;
  organ: string;
  location: string;
  deadline: string;
  value: string;
  score: number;
  risk: "low" | "medium" | "high";
  modalidade: string;
  situacao: string;
  link: string;
}

interface PncpResponse {
  opportunities: Opportunity[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  fetchedAt: string;
  source: string;
}

export default function RadarPage() {
  const [data, setData] = useState<PncpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("licitação");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUf, setSelectedUf] = useState<string>("");
  const [selectedModalidade, setSelectedModalidade] = useState<string>("");
  const [pagina, setPagina] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pagina: String(pagina) });
      if (selectedUf)         params.set("uf", selectedUf);
      if (selectedModalidade) params.set("modalidadeId", selectedModalidade);
      params.set("search", searchTerm || "licitação");

      const { data: result, error: fnErr } = await supabase.functions.invoke("pncp-proxy", {
        method: "GET",
        headers: { "x-query": params.toString() },
      });

      // functions.invoke doesn't support query params directly — use fetch instead
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pncp-proxy?${params}`,
        { headers: { "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json: PncpResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dados do PNCP");
    } finally {
      setLoading(false);
    }
  }, [pagina, selectedUf, selectedModalidade, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    fetchData();
  };

  const clearFilters = () => {
    setSelectedUf("");
    setSelectedModalidade("");
    setSearchTerm("licitação");
    setPagina(1);
  };

  const activeFilters = [
    selectedUf && `UF: ${selectedUf}`,
    selectedModalidade && MODALIDADES.find(m => m.id === selectedModalidade)?.label,
  ].filter(Boolean) as string[];

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <RadarIcon className="w-6 h-6 text-primary" /> Radar de Oportunidades
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data ? `${data.totalRegistros.toLocaleString("pt-BR")} licitações no PNCP` : "Buscando no Portal Nacional de Contratações..."}
              {data && (
                <span className="ml-2 text-xs text-muted-foreground/60">
                  · Atualizado {new Date(data.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por objeto, órgão..."
                  className="pl-10"
                  value={searchTerm === "licitação" ? "" : searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value || "licitação")}
                />
              </div>
              <Button type="submit" size="icon" variant="default"><Search className="w-4 h-4" /></Button>
            </form>
            <Button variant={showFilters ? "default" : "outline"} size="icon" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fetchData()} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Estado (UF)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {UFS.map((uf) => (
                    <button key={uf} onClick={() => { setSelectedUf(selectedUf === uf ? "" : uf); setPagina(1); }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedUf === uf
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                      }`}>
                      {uf}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Modalidade
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MODALIDADES.map((m) => (
                    <button key={m.id} onClick={() => { setSelectedModalidade(selectedModalidade === m.id ? "" : m.id); setPagina(1); }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        selectedModalidade === m.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                {activeFilters.map((f) => (
                  <span key={f} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{f}</span>
                ))}
                <button onClick={clearFilters} className="text-xs text-destructive ml-auto hover:underline">Limpar todos</button>
              </div>
            )}
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Falha ao carregar dados do PNCP</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Consultando Portal Nacional de Contratações Públicas...</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {data.opportunities.length === 0 ? (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <Building className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma licitação encontrada com os filtros atuais.</p>
                </div>
              ) : (
                data.opportunities.map((opp, i) => (
                  <OpportunityCard key={opp.id} {...opp} index={i} />
                ))
              )}
            </div>

            {/* Pagination */}
            {data.totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página <span className="font-semibold text-foreground">{pagina}</span> de {data.totalPaginas.toLocaleString("pt-BR")}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPagina(p => Math.min(data.totalPaginas, p + 1))} disabled={pagina === data.totalPaginas}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* PNCP attribution */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Dados públicos provenientes do{" "}
          <a href="https://pncp.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Portal Nacional de Contratações Públicas (PNCP)
          </a>
          {" "}· Lei 14.133/2021
        </p>
      </div>
    </LicitanteLayout>
  );
}
