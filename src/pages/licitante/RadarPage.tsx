import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, SlidersHorizontal, MapPin, Building, Tag, X,
  Radar as RadarIcon, Loader2, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight,
  Target, Sparkles, Bell, Briefcase, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { type EmpresaDados, formatarCnpj } from "@/lib/empresa";

// Ids oficiais de modalidade do PNCP (tabela de domínio da Lei 14.133):
// 6 Pregão Eletrônico · 4 Concorrência Eletrônica · 5 Concorrência Presencial ·
// 8 Dispensa · 9 Inexigibilidade · 12 Credenciamento
const MODALIDADES = [
  { id: "6",  label: "Pregão Eletrônico" },
  { id: "4",  label: "Concorrência Eletrônica" },
  { id: "5",  label: "Concorrência Presencial" },
  { id: "8",  label: "Dispensa" },
  { id: "9",  label: "Inexigibilidade" },
  { id: "12", label: "Credenciamento" },
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
  stale?: boolean;     // PNCP fora do ar → resultados do cache
  cachedAt?: string;
  fallback?: boolean;  // consulta oficial fora → busca do portal (menos confiável)
  fallbackNota?: string;
  fonte?: string;
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
  const [empresa, setEmpresa] = useState<EmpresaDados | null>(null);
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
        .select("empresa_perfil, empresa_dados, alerta_ativo, alerta_keywords, alerta_uf")
        .eq("id", user.id)
        .single();
      if (data?.empresa_perfil) setPerfil(data.empresa_perfil);
      if ((data as any)?.empresa_dados) setEmpresa((data as any).empresa_dados as EmpresaDados);
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
      toast({ title: "Cadastre sua empresa primeiro", description: "Digite o CNPJ em \"Minha empresa\" para a IA calcular o match.", variant: "destructive" });
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

      // functions.invoke não aceita query string — usa fetch direto
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pncp-proxy?${params}`,
        { headers: { "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );

      const json: PncpResponse & { error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
      setData(json);
    } catch (err: any) {
      setError(err.message || "O portal do PNCP está instável no momento. Tente novamente em alguns minutos.");
    } finally {
      setLoading(false);
    }
  }, [pagina, selectedUf, selectedModalidade, searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Com empresa cadastrada, o match roda sozinho a cada carga de resultados
  // (uma vez por carga — não insiste se a IA falhar).
  const autoMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.opportunities?.length || !perfil.trim() || matching) return;
    const chave = `${data.fetchedAt}|${data.numeroPagina}`;
    if (autoMatchRef.current === chave) return;
    autoMatchRef.current = chave;
    runMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, perfil]);

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
            {empresa || perfil ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {empresa ? (
                    <>
                      <p className="text-sm font-medium text-foreground truncate">{empresa.razaoSocial}</p>
                      <p className="text-xs text-muted-foreground">
                        CNPJ {formatarCnpj(empresa.cnpj)}
                        {empresa.cnaePrincipal ? ` · ${empresa.cnaePrincipal.descricao}` : ""}
                        {empresa.cnaesSecundarios?.length ? ` · +${empresa.cnaesSecundarios.length} atividades` : ""}
                        {empresa.uf ? ` · ${empresa.uf}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground line-clamp-2">{perfil}</p>
                  )}
                </div>
                <Link to="/licitante/empresa" className="text-xs text-primary hover:underline whitespace-nowrap inline-flex items-center gap-0.5 flex-shrink-0">
                  Ver / editar <ChevronRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Comece pelo CNPJ.</span> A Intelicite busca os dados da sua
                  empresa na Receita Federal e monta o perfil que a IA usa para pontuar cada licitação.
                </p>
                <Button size="sm" className="gap-2 flex-shrink-0" onClick={() => (window.location.href = "/licitante/empresa")}>
                  <Briefcase className="w-3.5 h-3.5" /> Cadastrar minha empresa
                </Button>
              </div>
            )}
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
              <p className="text-sm font-medium text-destructive">Não foi possível consultar o PNCP</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {data?.fallback && !data?.stale && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">PNCP instável — resultados em modo reserva</p>
              <p className="text-xs text-muted-foreground mt-0.5">{data.fallbackNota}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Atualizar</Button>
          </div>
        )}

        {data?.stale && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">O portal do PNCP está instável agora</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mostrando os últimos resultados que guardamos
                {data.cachedAt ? ` (${new Date(data.cachedAt).toLocaleString("pt-BR")})` : ""}. Os links "Abrir no PNCP"
                podem dar erro até o portal do governo voltar — tente de novo em alguns minutos.
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Atualizar</Button>
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
                    score={opp.score}
                    matchScore={matchMap[opp.id]?.match}
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
