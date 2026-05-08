import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, CheckCircle2, AlertTriangle, XCircle,
  FileText, Shield, TrendingUp, Scale, ChevronRight,
  Loader2, Search, Info,
} from "lucide-react";

interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  ativo: boolean;
  dataAbertura: string | null;
  capitalSocial: number;
  naturezaJuridica: string;
  porte: string;
  atividadePrincipal: string;
  municipio: string;
  uf: string;
  socios: { nome: string; qualificacao: string }[];
}

const statusConfig = {
  apto:       { label: "Apto",        icon: CheckCircle2, className: "bg-success/10 text-success border-success/20"              },
  risco:      { label: "Risco Médio", icon: AlertTriangle, className: "bg-amber-400/10 text-amber-400 border-amber-400/20"       },
  nao_atende: { label: "Não Atende",  icon: XCircle,      className: "bg-destructive/10 text-destructive border-destructive/20"  },
};

const itemStatusConfig = {
  disponivel: { label: "Disponível", className: "text-success"     },
  pendente:   { label: "Pendente",   className: "text-amber-400"   },
  vencido:    { label: "Vencido",    className: "text-destructive" },
};

function buildCategories(cnpj: CnpjData | null) {
  const situacaoOk = cnpj?.ativo ?? false;

  return [
    {
      name: "Habilitação Jurídica", icon: Scale,
      status: cnpj ? "apto" : "risco" as const,
      items: [
        { name: "Ato constitutivo / Contrato Social",   status: "disponivel" },
        { name: "Procuração do representante legal",     status: "pendente"   },
        { name: "Natureza jurídica verificada",          status: cnpj ? "disponivel" : "pendente" },
      ],
    },
    {
      name: "Regularidade Fiscal e Trabalhista", icon: Shield,
      status: situacaoOk ? "risco" : "nao_atende" as const,
      items: [
        { name: "Situação cadastral Receita Federal",   status: situacaoOk ? "disponivel" : "vencido" },
        { name: "CND Federal (Receita + PGFN)",         status: "pendente" },
        { name: "CND Estadual (ICMS)",                  status: "pendente" },
        { name: "Certidão FGTS",                        status: "pendente" },
        { name: "Certidão Trabalhista (CNDT)",          status: "pendente" },
      ],
    },
    {
      name: "Qualificação Técnica", icon: FileText,
      status: "nao_atende" as const,
      items: [
        { name: "Atestado de capacidade técnica",       status: "pendente"   },
        { name: "Registro no conselho profissional",    status: "pendente"   },
        { name: "Instalações e equipe técnica",         status: "pendente"   },
      ],
    },
    {
      name: "Qualificação Econômico-Financeira", icon: TrendingUp,
      status: (cnpj && cnpj.capitalSocial >= 100000) ? "apto" : "risco" as const,
      items: [
        { name: "Balanço patrimonial (último exercício)", status: "pendente"   },
        { name: "Demonstrações contábeis",                status: "pendente"   },
        { name: "Certidão negativa de falência",          status: "pendente"   },
      ],
    },
  ];
}

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function HabilitacaoPage() {
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const raw = cnpjInput.replace(/\D/g, "");
    if (raw.length !== 14) { setError("Digite um CNPJ válido com 14 dígitos."); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cnpj-proxy?cnpj=${raw}`,
        { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setCnpjData(json);
    } catch (err: any) {
      setError(err.message || "Falha ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  };

  const categories = buildCategories(cnpjData);

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Simulador de Habilitação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Consulta em tempo real na Receita Federal via BrasilAPI</p>
        </div>

        {/* CNPJ lookup */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card mb-6">
          <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Consultar Empresa</h3>
          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <Input
                value={cnpjInput}
                onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="00.000.000/0000-00"
                className="font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={lookup} disabled={loading} className="gap-2 w-full sm:w-auto">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Consultar Receita Federal
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </p>
          )}

          {/* Company data returned */}
          {cnpjData && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mt-5 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Razão Social</p>
                <p className="text-sm font-semibold text-card-foreground mt-0.5">{cnpjData.razaoSocial}</p>
              </div>
              {cnpjData.nomeFantasia && (
                <div>
                  <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                  <p className="text-sm text-card-foreground mt-0.5">{cnpjData.nomeFantasia}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Situação Cadastral</p>
                <p className={`text-sm font-semibold mt-0.5 ${cnpjData.ativo ? "text-success" : "text-destructive"}`}>
                  {cnpjData.situacaoCadastral}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capital Social</p>
                <p className="text-sm text-card-foreground mt-0.5">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cnpjData.capitalSocial)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Município / UF</p>
                <p className="text-sm text-card-foreground mt-0.5">{cnpjData.municipio}, {cnpjData.uf}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Porte</p>
                <p className="text-sm text-card-foreground mt-0.5">{cnpjData.porte || "—"}</p>
              </div>
              <div className="sm:col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground">Atividade Principal</p>
                <p className="text-sm text-card-foreground mt-0.5">{cnpjData.atividadePrincipal || "—"}</p>
              </div>
              {cnpjData.socios.length > 0 && (
                <div className="sm:col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1">Quadro Societário</p>
                  <div className="flex flex-wrap gap-2">
                    {cnpjData.socios.map((s) => (
                      <span key={s.nome} className="text-xs bg-muted/50 border border-border px-2.5 py-1 rounded-full text-card-foreground">
                        {s.nome} · <span className="text-muted-foreground">{s.qualificacao}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Info when no CNPJ yet */}
        {!cnpjData && !loading && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Digite o CNPJ da empresa para consultar os dados reais da Receita Federal e iniciar a análise de habilitação. Os status de documentos abaixo refletem o que foi carregado na plataforma.
            </p>
          </div>
        )}

        {/* Habilitação categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => {
            const StatusIcon = statusConfig[cat.status].icon;
            const CatIcon = cat.icon;
            return (
              <motion.div key={cat.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-card-foreground">{cat.name}</h3>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusConfig[cat.status].className}`}>
                    <StatusIcon className="w-3 h-3" />{statusConfig[cat.status].label}
                  </span>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <span className="text-sm text-card-foreground">{item.name}</span>
                      <span className={`text-xs font-medium ${itemStatusConfig[item.status as keyof typeof itemStatusConfig].className}`}>
                        {itemStatusConfig[item.status as keyof typeof itemStatusConfig].label}
                      </span>
                    </div>
                  ))}
                </div>
                {cat.status !== "apto" && (
                  <Button variant="ghost" size="sm" className="mt-3 text-xs text-primary gap-1">
                    Corrigir pendências <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Dados de CNPJ provenientes da{" "}
          <a href="https://www.gov.br/receitafederal" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Receita Federal do Brasil
          </a>{" "}via BrasilAPI · consulta em tempo real
        </p>
      </div>
    </LicitanteLayout>
  );
}
