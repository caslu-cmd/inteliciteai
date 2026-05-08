import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { KpiCard } from "@/components/licitante/KpiCard";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  FileSearch, TrendingUp, FileWarning, AlertTriangle,
  Upload, FileText, HelpCircle, Building2, Bell, Clock,
  Search, ChevronRight, Loader2, RefreshCw,
} from "lucide-react";

const alertIcons = { deadline: Clock, new: Bell, risk: AlertTriangle, doc: FileWarning };
const alertColors = { deadline: "text-amber-400", new: "text-primary", risk: "text-destructive", doc: "text-amber-400" };

interface Opportunity {
  id: string;
  title: string;
  organ: string;
  location: string;
  deadline: string;
  score: number;
  risk: "low" | "medium" | "high";
  value: string;
  modalidade: string;
  link: string;
  orgaoCnpj: string;
}

export default function LicitantePage() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalPncp, setTotalPncp] = useState<number | null>(null);
  const [minutasCount, setMinutasCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      // Fetch PNCP opportunities and minutas count in parallel
      const [pncpRes, minutasRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pncp-proxy?search=pregao&pagina=1`, { headers }),
        supabase.from("minutas").select("id", { count: "exact", head: true }),
      ]);

      if (pncpRes.ok) {
        const json = await pncpRes.json();
        setOpportunities((json.opportunities || []).slice(0, 4));
        setTotalPncp(json.totalRegistros || 0);
      }

      setMinutasCount(minutasRes.count || 0);
    } catch {
      // Fail silently on dashboard — individual pages handle their own errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalPncp !== null
                ? `${totalPncp.toLocaleString("pt-BR")} editais disponíveis no PNCP`
                : "Visão estratégica das suas licitações"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar licitações..."
                className="h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
                onKeyDown={(e) => { if (e.key === "Enter") navigate("/licitante/radar"); }}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={loadDashboardData} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Upload CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-hero rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden cursor-pointer"
          onClick={() => navigate("/licitante/scanner")}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-64 h-64 rounded-full bg-primary blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-white mb-1">Analise um edital com Claude AI</h2>
              <p className="text-white/70 text-sm max-w-md">
                Envie um PDF e receba diagnóstico completo: score, riscos, habilitação, prazos e recomendações — em segundos.
              </p>
            </div>
            <Button className="gap-2 flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20"
              onClick={(e) => { e.stopPropagation(); navigate("/licitante/scanner"); }}>
              <Upload className="w-4 h-4" /> Enviar Edital
            </Button>
          </div>
        </motion.div>

        {/* KPIs — real data where available */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            title="Editais no PNCP"
            value={totalPncp !== null ? totalPncp.toLocaleString("pt-BR") : "—"}
            icon={FileSearch}
            subtitle="Portal Nacional de Contratações"
          />
          <KpiCard
            title="Minutas Geradas"
            value={minutasCount}
            icon={FileText}
            subtitle="Impugnações e esclarecimentos"
            variant="success"
          />
          <KpiCard
            title="Documentos Pendentes"
            value={8}
            icon={FileWarning}
            trend={{ value: 3, positive: false }}
            variant="warning"
          />
          <KpiCard
            title="Alertas Críticos"
            value={3}
            icon={AlertTriangle}
            variant="destructive"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick actions panel */}
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-5 shadow-card">
            <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              {[
                { label: "Analisar Edital (PDF)", icon: FileSearch, route: "/licitante/scanner", desc: "Claude AI analisa em segundos" },
                { label: "Gerar Impugnação",       icon: FileText,   route: "/licitante/minutas",    desc: "Documento jurídico com IA" },
                { label: "Pedido de Esclarecimento", icon: HelpCircle, route: "/licitante/minutas",  desc: "Formal e fundamentado" },
                { label: "Verificar Habilitação",  icon: Building2,  route: "/licitante/habilitacao", desc: "Consulta Receita Federal" },
                { label: "Radar de Oportunidades", icon: FileSearch, route: "/licitante/radar",     desc: `${totalPncp !== null ? totalPncp.toLocaleString("pt-BR") + " editais" : "PNCP ao vivo"}` },
              ].map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => navigate(action.route)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Real opportunities from PNCP */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
                Oportunidades Recentes
                {totalPncp !== null && (
                  <span className="text-xs font-normal text-muted-foreground">— PNCP ao vivo</span>
                )}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/licitante/radar")}>
                Ver radar completo <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : opportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opportunities.map((opp, i) => (
                  <OpportunityCard key={opp.id || i} {...opp} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">Conectando ao PNCP...</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={loadDashboardData}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
