import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Briefcase, Loader2, Trash2, Sparkles, RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEMO_PROJECTS = [
  {
    title: "Elaboração de ETP para Sistema de Gestão Hospitalar",
    description: "Prefeitura de Campinas/SP necessita de consultor especializado para elaborar Estudo Técnico Preliminar (ETP) visando a contratação de sistema integrado de gestão hospitalar. O documento deverá atender integralmente ao art. 18 da Lei 14.133/2021 e incluir levantamento de mercado, análise de soluções disponíveis e estimativa de custo.",
    category: "etp",
    budget_min: 350000,
    budget_max: 700000,
    deadline: "2026-06-30",
    requirements: "Experiência comprovada em licitações de TI/Saúde. Conhecimento da Lei 14.133/2021. Ao menos 2 ETPs elaborados nos últimos 3 anos.",
  },
  {
    title: "Termo de Referência para Contratação de Serviços de Cloud Computing",
    description: "Tribunal de Contas do Estado do Maranhão (TCE-MA) busca consultor para redigir Termo de Referência completo para contratação de infraestrutura em nuvem (IaaS/PaaS). O TR deverá incluir modelo de contratação, métricas de desempenho (SLA), critérios de habilitação técnica e estimativas de consumo.",
    category: "tr",
    budget_min: 280000,
    budget_max: 550000,
    deadline: "2026-07-20",
    requirements: "Experiência em contratações de TI no setor público. Conhecimento em cloud computing (AWS, Azure ou GCP). Domínio da IN SGD/ME nº 94/2022.",
  },
  {
    title: "Assessoria Jurídica em Pregão Eletrônico — Equipamentos Médico-Hospitalares",
    description: "Secretaria de Saúde do Estado de Goiás necessita de advogado especialista em licitações para conduzir pregão eletrônico no valor estimado de R$ 4,2 milhões para aquisição de equipamentos médico-hospitalares. O consultor auxiliará desde a fase preparatória até a homologação, incluindo análise de recursos e impugnações.",
    category: "pregao",
    budget_min: 480000,
    budget_max: 900000,
    deadline: "2026-08-15",
    requirements: "Advogado inscrito na OAB. Mínimo de 5 pregões eletrônicos conduzidos. Experiência com COMPRASNET.",
  },
  {
    title: "Impugnação de Edital — Concorrência para Obras de Saneamento",
    description: "Empresa licitante contratará consultor jurídico para elaborar impugnação fundamentada ao Edital nº 003/2026 referente à contratação de obras de ampliação da rede de saneamento básico (R$ 12 milhões). O prazo para protocolo é curto; disponibilidade imediata obrigatória.",
    category: "impugnacao",
    budget_min: 150000,
    budget_max: 300000,
    deadline: "2026-05-28",
    requirements: "Advogado com experiência em direito administrativo. Conhecimento da Lei 14.133/2021 e jurisprudência do TCU sobre obras públicas. Disponibilidade imediata.",
  },
  {
    title: "Elaboração de DFD e Planejamento de Contratações 2027",
    description: "Instituto Federal do Paraná (IFPR) busca consultor para elaborar o Documento de Formalização da Demanda (DFD) e montar o Plano de Contratações Anual (PCA) 2027, conforme Decreto nº 10.947/2022. Escopo inclui mapeamento de necessidades de 22 campi.",
    category: "dfd",
    budget_min: 200000,
    budget_max: 420000,
    deadline: "2026-09-30",
    requirements: "Experiência em planejamento de contratações públicas. Conhecimento do PNCP e do módulo PCA do ComprasGov.",
  },
  {
    title: "Auditoria de Contratos de Terceirização de Serviços Gerais",
    description: "Câmara Municipal de São Paulo solicita auditoria completa em 14 contratos de terceirização (limpeza, vigilância e manutenção predial) vigentes, com valor global de R$ 28 milhões/ano. Inclui verificação de conformidade legal, análise de planilhas e relatório com recomendações.",
    category: "auditoria",
    budget_min: 600000,
    budget_max: 1200000,
    deadline: "2026-07-31",
    requirements: "Contador ou administrador com especialização em auditoria pública. Experiência em análise de planilhas de composição de custos conforme IN SEGES nº 5/2017.",
  },
  {
    title: "Gestão de Contratos de Fornecimento de Merenda Escolar",
    description: "Secretaria de Educação de Fortaleza/CE necessita de profissional para gestão de 6 contratos de fornecimento de gêneros alimentícios para o PNAE, com valor anual de R$ 18 milhões. Atividades: fiscalização de entregas, controle de qualidade e relatórios mensais.",
    category: "gestao",
    budget_min: 250000,
    budget_max: 480000,
    deadline: "2026-12-31",
    requirements: "Nutricionista, administrador ou advogado com experiência em contratos alimentares. Conhecimento do PNAE e da Lei Orgânica de Segurança Alimentar.",
  },
  {
    title: "Consultoria para Implementação do Sistema de Registro de Preços",
    description: "Consórcio Intermunicipal do Vale do Paraíba (12 municípios) busca consultor para estruturar e implementar Sistema de Registro de Preços (SRP) compartilhado. Inclui mapeamento de demandas, elaboração de editais-modelo, capacitação das equipes e acompanhamento das primeiras atas.",
    category: "consultoria",
    budget_min: 320000,
    budget_max: 650000,
    deadline: "2026-10-15",
    requirements: "Experiência comprovada em implantação de SRP. Conhecimento do Decreto 11.462/2023 e das normas do PNCP.",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  etp: "ETP", tr: "TR", dfd: "DFD", impugnacao: "Impugnação",
  pregao: "Pregão", dispensa: "Dispensa", auditoria: "Auditoria",
  gestao: "Gestão Contratual", consultoria: "Consultoria Geral",
};

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminMarketplaceTab() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("marketplace_projects" as any).select("id, title, category, budget_min, budget_max, status, created_at").order("created_at", { ascending: false }));
    setProjects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleSeed = async () => {
    setSeeding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Usuário não autenticado", variant: "destructive" }); setSeeding(false); return; }

    const rows = DEMO_PROJECTS.map(p => ({ ...p, client_id: user.id, status: "open" }));
    const { error } = await (supabase.from("marketplace_projects" as any).insert(rows));

    if (error) {
      toast({ title: "Erro ao gerar projetos", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${DEMO_PROJECTS.length} projetos demo criados com sucesso!` });
      loadProjects();
    }
    setSeeding(false);
  };

  const handleClear = async () => {
    setClearing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClearing(false); return; }

    const { error } = await (supabase.from("marketplace_projects" as any).delete().eq("client_id", user.id));
    if (error) {
      toast({ title: "Erro ao remover projetos", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Projetos demo removidos" });
      loadProjects();
    }
    setClearing(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{projects.length} projeto{projects.length !== 1 ? "s" : ""} no marketplace</p>
          <p className="text-xs text-muted-foreground mt-0.5">Projetos visíveis para consultores verificados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-2 h-9" onClick={loadProjects} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 text-destructive hover:text-destructive" onClick={handleClear} disabled={clearing}>
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Limpar meus projetos
          </Button>
          <Button size="sm" className="gap-2 h-9" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar {DEMO_PROJECTS.length} projetos demo
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-5">Título</div>
          <div className="col-span-2">Categoria</div>
          <div className="col-span-3">Orçamento</div>
          <div className="col-span-2">Status</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhum projeto no marketplace</p>
            <p className="text-xs text-muted-foreground/60">Clique em "Gerar projetos demo" para popular o marketplace</p>
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 items-center border-b border-border last:border-b-0 px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="col-span-5">
                <p className="text-sm font-medium truncate">{p.title}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category] || p.category}</span>
              </div>
              <div className="col-span-3 text-xs text-muted-foreground font-mono">
                {fmtMoney(p.budget_min)} – {fmtMoney(p.budget_max)}
              </div>
              <div className="col-span-2">
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  p.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-secondary text-muted-foreground"
                )}>
                  {p.status === "open" ? "Aberto" : p.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Nota:</strong> Os projetos demo são criados com seu usuário como cliente. Consultores verificados verão esses projetos e poderão se candidatar. Para remover, clique em "Limpar meus projetos".
      </div>
    </motion.div>
  );
}
