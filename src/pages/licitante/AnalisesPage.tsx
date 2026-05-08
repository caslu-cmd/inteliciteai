import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { RiskBadge } from "@/components/licitante/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, FileSearch, Eye, Download, Filter,
  ChevronUp, ChevronDown, Loader2, AlertTriangle, ExternalLink, RefreshCw,
} from "lucide-react";

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
  dataAbertura: string | null;
}

export default function AnalisesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("deadline");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [totalRegistros, setTotalRegistros] = useState(0);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ pagina: "1", tamanhoPagina: "50" });
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pncp-proxy?${params}`,
        { headers: { "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setItems(json.opportunities || []);
      setTotalRegistros(json.totalRegistros || 0);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field
      ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : null;

  const sorted = [...items].sort((a, b) => {
    let va: any = a[sortField as keyof Opportunity] ?? "";
    let vb: any = b[sortField as keyof Opportunity] ?? "";
    if (sortField === "score") { va = Number(va); vb = Number(vb); }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <FileSearch className="w-6 h-6 text-primary" /> Análises de Editais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Buscando no PNCP..." : `${totalRegistros.toLocaleString("pt-BR")} editais no portal · exibindo ${sorted.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); fetchData(); }} className="flex items-center gap-2">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Button type="submit" variant="outline" size="sm" className="gap-1.5"><Filter className="w-3.5 h-3.5" /> Buscar</Button>
            </form>
            <Button variant="ghost" size="icon" onClick={fetchData} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Consultando Portal Nacional de Contratações Públicas...</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      { key: "organ",     label: "Órgão"       },
                      { key: "title",     label: "Objeto"      },
                      { key: "modalidade", label: "Modalidade" },
                      { key: "location",  label: "Local"       },
                      { key: "score",     label: "Score"       },
                      { key: "risk",      label: "Risco"       },
                      { key: "deadline",  label: "Abertura"    },
                    ].map((col) => (
                      <th key={col.key} onClick={() => toggleSort(col.key)}
                        className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap">
                        <span className="flex items-center gap-1">{col.label} <SortIcon field={col.key} /></span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-sm">Nenhum edital encontrado.</td></tr>
                  ) : sorted.map((item, i) => (
                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-card-foreground text-xs max-w-[160px] truncate" title={item.organ}>{item.organ}</td>
                      <td className="px-4 py-3 text-card-foreground max-w-[280px] truncate" title={item.title}>{item.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.modalidade || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.location}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${item.score}%` }}
                              transition={{ delay: i * 0.02, duration: 0.5 }}
                              className={`h-full rounded-full ${item.score >= 70 ? "bg-success" : item.score >= 50 ? "bg-amber-400" : "bg-destructive"}`}
                            />
                          </div>
                          <span className="text-xs font-semibold text-card-foreground">{item.score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><RiskBadge level={item.risk} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.deadline}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Analisar edital" onClick={() => navigate("/licitante/scanner")}>
                            <FileSearch className="w-3.5 h-3.5" />
                          </Button>
                          <a href={item.link} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir no PNCP">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Dados do{" "}
          <a href="https://pncp.gov.br" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Portal Nacional de Contratações Públicas
          </a>{" "}· Lei 14.133/2021
        </p>
      </div>
    </LicitanteLayout>
  );
}
