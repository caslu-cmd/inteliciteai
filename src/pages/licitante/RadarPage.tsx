import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, SlidersHorizontal, MapPin, Building, Tag, X,
  Radar as RadarIcon, Loader2, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight,
  Target, Sparkles, Bell,
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

  // Match IA
  const { toast } = useToast();
  const [perfil, setPerfil] = useState("");
  const [showPerfil, setShowPerfil] = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchMap, setMatchMap] = useState<Record<string, { match: number; motivo: string }>>({});

  // Alertas automáticos
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [alertaKeywords, setAlertaKeywords] = useState("");
  const [alertaUf, setAlertaUf] = useState("");

  // Carrega o perfil e as preferências de alerta do usuário
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("empresa_perfil, alerta_ativo, alerta_keywords, alerta_uf")
        .eq("id", user.id)
        .single();
      if (data?.empresa_perfil) setPerfil(data.empresa_perfil);
      if (data?.alerta_ativo) setAlertaAtivo(Boolean(data.alerta_ativo));
      if (data?.alerta_keywords) setAlertaKeywords(data.alerta_keywords);
      if (data?.alerta_uf) setAlertaUf(data.alerta_uf);
    })();
  }, []);

  const savePerfil = async () => {
    setSavingPerfil(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        empresa_perfil: perfil,
        alerta_ativo: alertaAtivo,
        alerta_keywords: alertaKeywords.trim() || null,
        alerta_uf: alertaUf || null,
      }).eq("id", user.id);
    }
    setSavingPerfil(false);
    toast({
      title: "Preferências salvas",
      description: alertaAtivo
        ? "Você receberá alertas diários de novos editais compatíveis."
        : "Perfil atualizado. Ative os alertas para ser avisado de novos editais.",
    });
  };

  const runMatch = async () => {
    if (!perfil.trim()) {
      setShowPerfil(true);
      toast({ title: "Descreva sua empresa primeiro", description: "Preencha o que sua empresa fornece para a IA calcular o match.", variant: "destructive" });
      return;
    }
    if (!data?.opportunities?.length) return;
    setMatching(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: res, error } = await supabase.functions.invoke("match-oportunidades", {
      body: { perfil, itens: data.opportunities.map((o) => ({ id: o.id, title: o.title, organ: o.organ })) },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setMatching(false);
    if (error || res?.error || !res?.scores?.length) {
      toast({ title: "Não foi possível calcular o match", description: res?.error || error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    const map: Record<string, { match: number; motivo: string }> = {};
    for (const s of res.scores) map[String(s.id)] = { match: s.match, motivo: s.motivo };
    setMatchMap(map);
    toast({ title: "Match calculado", description: "As oportunidades foram ordenadas pela aderência à sua empresa." });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMatchMap({}); // resultados novos → limpa o match anterior
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
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPerfil(!showPerfil)} title="Perfil da empresa (Match IA)">
              <Building className="w-4 h-4" /> Perfil
            </Button>
            <Button size="sm" className="gap-2" onClick={runMatch} disabled={matching || loading || !data?.opportunities?.length}>
              {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Match IA
            </Button>
          </div>
        </div>

        {/* Perfil da empresa (Match IA) */}
        {showPerfil && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-primary" /> Perfil da sua empresa
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Descreva o que sua empresa fornece (produtos, serviços, segmentos, palavras-chave). A IA usa isso para
              pontuar o quanto cada licitação combina com você.
            </p>
            <Textarea
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
              rows={3}
              placeholder="Ex.: Fornecemos equipamentos de informática (notebooks, servidores), licenciamento de software e serviços de TI para o setor público. Atendemos em SP, MG e RJ."
            />
            {/* Alertas automáticos de editais */}
            <div className="mt-5 pt-5 border-t border-border">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertaAtivo}
                  onChange={(e) => setAlertaAtivo(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                />
                <span>
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-primary" /> Alertas automáticos de editais
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Todo dia buscamos no PNCP novos editais que combinam com você e enviamos uma notificação.
                    Você não precisa mais ficar procurando.
                  </span>
                </span>
              </label>

              {alertaAtivo && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Palavras-chave
                    </p>
                    <Input
                      value={alertaKeywords}
                      onChange={(e) => setAlertaKeywords(e.target.value)}
                      placeholder="Ex.: notebook, servidor, licença de software"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Estado (opcional)
                    </p>
                    <select
                      value={alertaUf}
                      onChange={(e) => setAlertaUf(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Todos os estados</option>
                      {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={savePerfil} disabled={savingPerfil}>
                {savingPerfil ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Salvar preferências"}
              </Button>
              <Button size="sm" className="gap-2" onClick={runMatch} disabled={matching || !data?.opportunities?.length}>
                {matching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                Calcular match
              </Button>
            </div>
          </motion.div>
        )}

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
                (Object.keys(matchMap).length > 0
                  ? [...data.opportunities].sort(
                      (a, b) => (matchMap[b.id]?.match ?? -1) - (matchMap[a.id]?.match ?? -1)
                    )
                  : data.opportunities
                ).map((opp, i) => (
                  <OpportunityCard
                    key={opp.id}
                    {...opp}
                    score={matchMap[opp.id]?.match ?? opp.score}
                    matchReason={matchMap[opp.id]?.motivo}
                    index={i}
                  />
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
