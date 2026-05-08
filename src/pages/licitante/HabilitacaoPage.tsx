import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, CheckCircle2, AlertTriangle, XCircle,
  FileText, Shield, TrendingUp, Scale, ChevronRight,
  Loader2, Search, Info, ExternalLink, Copy, Check,
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

const statusCfg = {
  apto:       { label: "Apto",        icon: CheckCircle2,  cls: "bg-success/10 text-success border-success/20"              },
  risco:      { label: "Risco Médio", icon: AlertTriangle, cls: "bg-amber-400/10 text-amber-400 border-amber-400/20"       },
  nao_atende: { label: "Não Atende",  icon: XCircle,       cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

const itemCfg = {
  disponivel: { label: "Disponível", cls: "text-success"     },
  pendente:   { label: "Pendente",   cls: "text-amber-400"   },
  vencido:    { label: "Vencido",    cls: "text-destructive" },
};

// Certidões exigidas pela Lei 14.133/2021 Art. 68
const CERTIDOES = [
  {
    name: "CND Federal",
    desc: "Receita Federal + PGFN",
    ref: "Art. 68, II — Lei 14.133/2021",
    url: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/EmitirCertidao",
  },
  {
    name: "Certidão FGTS",
    desc: "Caixa Econômica Federal",
    ref: "Art. 68, IV — Lei 14.133/2021",
    url: "https://consulta-crf.caixa.gov.br/consultacrf/main.asp",
  },
  {
    name: "CNDT",
    desc: "Certidão de Débitos Trabalhistas — TST",
    ref: "Art. 68, V — Lei 14.133/2021",
    url: "https://cndt.tst.jus.br/",
  },
  {
    name: "CND Estadual",
    desc: "ICMS — SEFAZ do estado da empresa",
    ref: "Art. 68, III — Lei 14.133/2021",
    url: "https://www.confaz.fazenda.gov.br/legislacao/convenios/resolucoes/SEFAZ",
  },
  {
    name: "CND Municipal",
    desc: "ISS — Prefeitura do município",
    ref: "Art. 68, III — Lei 14.133/2021",
    url: null,
  },
];

function buildCategories(d: CnpjData | null) {
  const ativo = d?.ativo ?? false;
  return [
    {
      name: "Habilitação Jurídica", icon: Scale,
      status: d ? "apto" : "risco" as const,
      items: [
        { name: "Ato constitutivo / Contrato Social",  status: "disponivel" },
        { name: "Procuração do representante legal",    status: "pendente"   },
        { name: "Natureza jurídica verificada",         status: d ? "disponivel" : "pendente" },
      ],
    },
    {
      name: "Regularidade Fiscal e Trabalhista", icon: Shield,
      status: ativo ? "risco" : "nao_atende" as const,
      items: [
        { name: "Situação cadastral Receita Federal",   status: ativo ? "disponivel" : "vencido" },
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
        { name: "Atestado de capacidade técnica",       status: "pendente" },
        { name: "Registro no conselho profissional",    status: "pendente" },
        { name: "Instalações e equipe técnica",         status: "pendente" },
      ],
    },
    {
      name: "Qualificação Econômico-Financeira", icon: TrendingUp,
      status: (d && d.capitalSocial >= 100000) ? "apto" : "risco" as const,
      items: [
        { name: "Balanço patrimonial (último exercício)", status: "pendente" },
        { name: "Demonstrações contábeis",                status: "pendente" },
        { name: "Certidão negativa de falência",          status: "pendente" },
      ],
    },
  ];
}

function fmtCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export default function HabilitacaoPage() {
  const [cnpjInput, setCnpjInput] = useState("");
  const [data, setData] = useState<CnpjData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setData(json);
    } catch (err: any) {
      setError(err.message || "Falha ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  };

  const copyCnpj = async () => {
    await navigator.clipboard.writeText(cnpjInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categories = buildCategories(data);

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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card mb-6">
          <h3 className="font-display font-semibold text-base text-card-foreground mb-4">Consultar Empresa</h3>
          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <Input
                value={cnpjInput}
                onChange={(e) => setCnpjInput(fmtCnpj(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="00.000.000/0000-00"
                className="font-mono"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={lookup} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Consultar Receita Federal
              </Button>
              {cnpjInput.replace(/\D/g, "").length === 14 && (
                <Button variant="outline" size="icon" onClick={copyCnpj} title="Copiar CNPJ">
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </p>
          )}

          {/* Company data */}
          {data && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-5 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Razão Social</p>
                <p className="text-sm font-semibold text-card-foreground mt-0.5">{data.razaoSocial}</p>
              </div>
              {data.nomeFantasia && (
                <div>
                  <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                  <p className="text-sm text-card-foreground mt-0.5">{data.nomeFantasia}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Situação Cadastral</p>
                <p className={`text-sm font-semibold mt-0.5 ${data.ativo ? "text-success" : "text-destructive"}`}>
                  {data.situacaoCadastral}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capital Social</p>
                <p className="text-sm text-card-foreground mt-0.5">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.capitalSocial)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Município / UF</p>
                <p className="text-sm text-card-foreground mt-0.5">{data.municipio}, {data.uf}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Porte</p>
                <p className="text-sm text-card-foreground mt-0.5">{data.porte || "—"}</p>
              </div>
              <div className="sm:col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground">Atividade Principal</p>
                <p className="text-sm text-card-foreground mt-0.5">{data.atividadePrincipal || "—"}</p>
              </div>
              {data.socios.length > 0 && (
                <div className="sm:col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Quadro Societário</p>
                  <div className="flex flex-wrap gap-2">
                    {data.socios.map((s) => (
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

        {/* Certidões section — shown after CNPJ lookup */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-card-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Certidões — Art. 68 Lei 14.133/2021
              </h3>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={copyCnpj}>
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar CNPJ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Clique para abrir o portal. O CNPJ já está copiado — cole diretamente no campo de busca.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CERTIDOES.map((cert) => (
                <div key={cert.name}
                  className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{cert.name}</p>
                      <p className="text-xs text-muted-foreground">{cert.desc}</p>
                    </div>
                    {cert.url ? (
                      <a href={cert.url} target="_blank" rel="noopener noreferrer" onClick={copyCnpj}>
                        <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" title="Abrir portal">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    ) : (
                      <div className="h-7 w-7 flex-shrink-0 flex items-center justify-center text-muted-foreground/40">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/60">{cert.ref}</p>
                  {!cert.url && (
                    <p className="text-[10px] text-muted-foreground/50">Consulte no site da prefeitura do município</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Info when no CNPJ yet */}
        {!data && !loading && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Insira o CNPJ para consultar os dados da Receita Federal e acessar os portais de certidões com um clique.
            </p>
          </div>
        )}

        {/* Habilitação categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => {
            const StatusIcon = statusCfg[cat.status].icon;
            const CatIcon = cat.icon;
            return (
              <motion.div key={cat.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }} className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CatIcon className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm text-card-foreground">{cat.name}</h3>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusCfg[cat.status].cls}`}>
                    <StatusIcon className="w-3 h-3" />{statusCfg[cat.status].label}
                  </span>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <span className="text-sm text-card-foreground">{item.name}</span>
                      <span className={`text-xs font-medium ${itemCfg[item.status as keyof typeof itemCfg].cls}`}>
                        {itemCfg[item.status as keyof typeof itemCfg].label}
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
          Dados de CNPJ da{" "}
          <a href="https://www.gov.br/receitafederal" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
            Receita Federal do Brasil
          </a>{" "}via BrasilAPI · consulta em tempo real
        </p>
      </div>
    </LicitanteLayout>
  );
}
