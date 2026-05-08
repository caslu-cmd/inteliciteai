import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { KpiCard } from "@/components/licitante/KpiCard";
import { OpportunityCard } from "@/components/licitante/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FileSearch, TrendingUp, FileWarning, AlertTriangle,
  Upload, FileText, HelpCircle, Building2, Bell, Clock,
  Search, ChevronRight,
} from "lucide-react";

const alerts = [
  { id: 1, type: "deadline" as const, message: "Pregão Eletrônico 045/2025 - Abertura em 2 dias", time: "Há 30 min", route: "/licitante/analises" },
  { id: 2, type: "new" as const,      message: "Nova licitação compatível: Serviços de TI - TJSP",  time: "Há 1h",    route: "/licitante/radar" },
  { id: 3, type: "risk" as const,     message: "Cláusula restritiva detectada em PE 032/2025",       time: "Há 2h",    route: "/licitante/analises" },
  { id: 4, type: "doc" as const,      message: "Certidão FGTS vence em 5 dias - Renovar",           time: "Há 3h",    route: "/licitante/documentos" },
];

const opportunities = [
  { title: "Pregão Eletrônico - Aquisição de equipamentos de TI e infraestrutura de rede", organ: "Ministério da Saúde",     location: "Brasília, DF",    deadline: "22 Mar 2026", score: 78, risk: "low"    as const, value: "R$ 2.450.000,00" },
  { title: "Concorrência - Serviços de consultoria em segurança da informação",              organ: "Tribunal de Justiça SP", location: "São Paulo, SP",   deadline: "28 Mar 2026", score: 52, risk: "medium" as const, value: "R$ 890.000,00"   },
  { title: "Pregão Presencial - Fornecimento de licenças de software corporativo",           organ: "Prefeitura de Curitiba", location: "Curitiba, PR",    deadline: "01 Abr 2026", score: 34, risk: "high"   as const, value: "R$ 1.200.000,00" },
];

const alertIcons = { deadline: Clock, new: Bell, risk: AlertTriangle, doc: FileWarning };
const alertColors = { deadline: "text-amber-400", new: "text-primary", risk: "text-destructive", doc: "text-amber-400" };

export default function LicitantePage() {
  const navigate = useNavigate();

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão estratégica das suas licitações</p>
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
            <Popover>
              <PopoverTrigger asChild>
                <Button className="relative" size="icon" variant="ghost">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b border-border">
                  <h4 className="font-semibold text-sm">Notificações</h4>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {alerts.map((alert) => {
                    const Icon = alertIcons[alert.type];
                    return (
                      <button key={alert.id} onClick={() => navigate(alert.route)}
                        className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors w-full text-left">
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alertColors[alert.type]}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-card-foreground leading-snug">{alert.message}</p>
                          <span className="text-xs text-muted-foreground">{alert.time}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Upload CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gradient-hero rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden cursor-pointer"
          onClick={() => navigate("/licitante/scanner")}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-64 h-64 rounded-full bg-primary blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-white mb-1">Analise um edital em segundos</h2>
              <p className="text-white/70 text-sm max-w-md">
                Envie um PDF e receba diagnóstico estratégico completo: riscos, habilitação, prazos e ações recomendadas.
              </p>
            </div>
            <Button className="gap-2 flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20"
              onClick={(e) => { e.stopPropagation(); navigate("/licitante/scanner"); }}>
              <Upload className="w-4 h-4" />
              Enviar Edital
            </Button>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Licitações Analisadas" value={47} icon={FileSearch} trend={{ value: 12, positive: true }} subtitle="Este mês" />
          <KpiCard title="Score Médio de Vitória" value="64%" icon={TrendingUp} trend={{ value: 5, positive: true }} variant="success" />
          <KpiCard title="Documentos Pendentes" value={8} icon={FileWarning} trend={{ value: 3, positive: false }} variant="warning" />
          <KpiCard title="Alertas Críticos" value={3} icon={AlertTriangle} variant="destructive" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts */}
          <div className="lg:col-span-1 bg-card rounded-xl border border-border p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-card-foreground">Alertas</h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/licitante/radar")}>
                Ver todos <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {alerts.map((alert, i) => {
                const Icon = alertIcons[alert.type];
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(alert.route)}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alertColors[alert.type]}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-card-foreground leading-snug">{alert.message}</p>
                      <span className="text-xs text-muted-foreground">{alert.time}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Opportunities */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-foreground">Radar de Oportunidades</h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/licitante/radar")}>
                Ver radar completo <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {opportunities.map((opp, i) => (
                <OpportunityCard key={i} {...opp} index={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2 text-sm" onClick={() => navigate("/licitante/minutas")}>
            <FileText className="w-4 h-4" /> Gerar Impugnação
          </Button>
          <Button variant="outline" className="gap-2 text-sm" onClick={() => navigate("/licitante/minutas")}>
            <HelpCircle className="w-4 h-4" /> Pedido de Esclarecimento
          </Button>
          <Button variant="outline" className="gap-2 text-sm" onClick={() => navigate("/licitante/habilitacao")}>
            <Building2 className="w-4 h-4" /> Cadastrar Empresa
          </Button>
        </div>
      </div>
    </LicitanteLayout>
  );
}
