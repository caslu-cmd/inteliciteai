import { useState } from "react";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Scale, Gavel, Loader2, AlertTriangle, CheckCircle2, ShieldAlert,
  XCircle, FileText, Clock, ListChecks, Sparkles, BookOpen, Radio,
} from "lucide-react";

interface Ponto { titulo: string; situacao: string; analise: string; fundamento?: string; fonte?: string; }
interface Fonte { rotulo: string; url?: string; }
interface Parecer {
  tipoDetectado?: string;
  veredito?: string;
  resumo?: string;
  pontos?: Ponto[];
  impugnacoes?: string[];
  habilitacao?: string[];
  prazos?: string[];
  recomendacaoFinal?: string;
  fontes?: Fonte[];
}

// Mapeia uma referência de norma para o link oficial (determinístico, sem inventar).
const LEGIS_LINKS: { re: RegExp; url: string }[] = [
  { re: /14\.?133/, url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm" },
  { re: /10\.?520/, url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10520.htm" },
  { re: /(lc|complementar).*123|123\/2006/i, url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm" },
  { re: /8\.?666/, url: "https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm" },
  { re: /11\.?462/, url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11462.htm" },
  { re: /11\.?246/, url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11246.htm" },
  { re: /10\.?024/, url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d10024.htm" },
  { re: /65\/2021|65\.2021/, url: "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-65-de-7-de-julho-de-2021" },
  { re: /58\/2022|58\.2022/, url: "https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-seges-me-no-58-de-8-de-agosto-de-2022" },
];

function linkDaFonte(texto?: string, url?: string): string | null {
  if (url && /^https?:\/\//.test(url)) return url;
  if (!texto) return null;
  return LEGIS_LINKS.find((l) => l.re.test(texto))?.url || null;
}

const TIPOS = [
  { v: "auto", label: "Detectar automaticamente" },
  { v: "edital", label: "Edital" },
  { v: "proposta", label: "Proposta / Habilitação" },
  { v: "contrato", label: "Contrato / Aditivo" },
];

const VEREDITO: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  participar:               { label: "Participar", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25", Icon: CheckCircle2 },
  conforme:                 { label: "Conforme", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25", Icon: CheckCircle2 },
  participar_com_ressalvas: { label: "Participar com ressalvas", cls: "bg-amber-400/10 text-amber-600 border-amber-400/25", Icon: ShieldAlert },
  ajustes_necessarios:      { label: "Ajustes necessários", cls: "bg-amber-400/10 text-amber-600 border-amber-400/25", Icon: ShieldAlert },
  impugnar:                 { label: "Impugnar", cls: "bg-orange-500/10 text-orange-600 border-orange-500/25", Icon: Gavel },
  nao_recomendado:          { label: "Não recomendado", cls: "bg-destructive/10 text-destructive border-destructive/25", Icon: XCircle },
};

const SIT: Record<string, { cls: string; Icon: React.ElementType }> = {
  ok:     { cls: "text-emerald-600", Icon: CheckCircle2 },
  atencao:{ cls: "text-amber-600",  Icon: ShieldAlert },
  risco:  { cls: "text-orange-600", Icon: AlertTriangle },
  ilegal: { cls: "text-destructive", Icon: XCircle },
};

export default function ParecerPage() {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [parecer, setParecer] = useState<Parecer | null>(null);
  const [temBase, setTemBase] = useState(false);

  const gerar = async () => {
    if (texto.trim().length < 50) {
      toast({ title: "Cole o texto do documento", description: "Precisa de pelo menos algumas linhas para analisar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setParecer(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("parecer-juridico", {
        body: { texto, tipo, titulo },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setParecer(data.parecer);
      setTemBase(!!data.temBase);
    } catch (err: any) {
      toast({ title: "Não foi possível gerar o parecer", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const v = parecer?.veredito ? VEREDITO[parecer.veredito] : null;

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" /> Parecer IA — Advogado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cole um edital, sua proposta/habilitação ou um contrato. A IA analisa como um advogado,
            apontando riscos, ilegalidades e pontos de impugnação — com as fontes.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
              <BookOpen className="w-3 h-3 text-primary" />
              <span><strong className="text-foreground">Legislação</strong> — base indexada, atualizada diariamente</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
              <Radio className="w-3 h-3" />
              <span><strong>Jurisprudência TCU/AGU</strong> — busca ao vivo, em tempo real</span>
            </span>
          </div>
        </div>

        {/* Entrada */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card space-y-3 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Identificação (opcional)</p>
              <Input placeholder="Ex.: Pregão 90012/2025 - Prefeitura de..." value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tipo</p>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Texto do documento</p>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={9}
              placeholder="Cole aqui o texto do edital, da sua proposta/habilitação ou do contrato..."
              className="text-xs"
            />
            {texto && <p className="text-[10px] text-muted-foreground mt-1">{texto.length.toLocaleString("pt-BR")} caracteres</p>}
          </div>
          <div className="flex justify-end">
            <Button className="gap-2" onClick={gerar} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
              {loading ? "Analisando..." : "Gerar parecer"}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">O Advogado IA está analisando o documento e a base jurídica...</p>
          </div>
        )}

        {/* Resultado */}
        {parecer && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Veredito + resumo */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                {v && (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${v.cls}`}>
                    <v.Icon className="w-4 h-4" /> {v.label}
                  </span>
                )}
                {parecer.tipoDetectado && (
                  <span className="text-xs text-muted-foreground capitalize">Documento: {parecer.tipoDetectado}</span>
                )}
              </div>
              {parecer.resumo && <p className="text-sm text-card-foreground leading-relaxed">{parecer.resumo}</p>}
            </div>

            {/* Pontos analisados */}
            {parecer.pontos?.length ? (
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-4">
                  <ListChecks className="w-4 h-4 text-primary" /> Análise ponto a ponto
                </p>
                <div className="space-y-4">
                  {parecer.pontos.map((p, i) => {
                    const s = SIT[p.situacao] || SIT.atencao;
                    return (
                      <div key={i} className="border-l-2 border-border pl-3">
                        <p className="text-sm font-medium text-card-foreground flex items-start gap-1.5">
                          <s.Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${s.cls}`} />
                          {p.titulo}
                        </p>
                        {p.analise && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.analise}</p>}
                        {(p.fonte || p.fundamento) && (() => {
                          const rot = p.fonte || p.fundamento!;
                          const href = linkDaFonte(rot);
                          return href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline mt-1 inline-block">📎 {rot}</a>
                          ) : (
                            <p className="text-[11px] text-primary/80 mt-1">📎 {rot}</p>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Colunas: impugnações / habilitação / prazos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {parecer.impugnacoes?.length ? (
                <ListaCard titulo="Pontos de impugnação" icon={Gavel} itens={parecer.impugnacoes} />
              ) : null}
              {parecer.habilitacao?.length ? (
                <ListaCard titulo="Habilitação a observar" icon={FileText} itens={parecer.habilitacao} />
              ) : null}
              {parecer.prazos?.length ? (
                <ListaCard titulo="Prazos" icon={Clock} itens={parecer.prazos} />
              ) : null}
            </div>

            {/* Recomendação */}
            {parecer.recomendacaoFinal && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" /> Recomendação final
                </p>
                <p className="text-sm text-card-foreground leading-relaxed">{parecer.recomendacaoFinal}</p>
              </div>
            )}

            {/* Fontes (recolhível) */}
            {(() => {
              const brutas: Fonte[] = parecer.fontes?.length
                ? parecer.fontes
                : (parecer.pontos || []).map((p) => ({ rotulo: p.fonte || p.fundamento || "" }));
              const vistos = new Set<string>();
              const fontes = brutas
                .filter((f) => f.rotulo && !vistos.has(f.rotulo) && vistos.add(f.rotulo))
                .map((f) => ({ rotulo: f.rotulo, href: linkDaFonte(f.rotulo, f.url) }));
              if (fontes.length === 0) return null;
              return (
                <details className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground flex items-center gap-1.5 select-none">
                    <BookOpen className="w-4 h-4 text-primary" /> Fontes ({fontes.length})
                  </summary>
                  <ul className="px-5 pb-4 space-y-1.5">
                    {fontes.map((f, i) => (
                      <li key={i} className="text-xs flex gap-1.5">
                        <span className="text-primary">•</span>
                        {f.href ? (
                          <a href={f.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{f.rotulo}</a>
                        ) : (
                          <span className="text-muted-foreground">{f.rotulo}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })()}

            <p className="text-xs text-muted-foreground/70 border-t border-border pt-3">
              ⚖️ Este parecer é gerado por IA como apoio à decisão — com base na legislação indexada e na
              <strong> jurisprudência do TCU/AGU buscada ao vivo</strong> — e
              <strong> não substitui a análise de um advogado</strong>. Confira as fontes antes de decidir.
            </p>
          </motion.div>
        )}
      </div>
    </LicitanteLayout>
  );
}

function ListaCard({ titulo, icon: Icon, itens }: { titulo: string; icon: React.ElementType; itens: string[] }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-card">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
        <Icon className="w-4 h-4 text-primary" /> {titulo}
      </p>
      <ul className="space-y-2">
        {itens.map((it, i) => (
          <li key={i} className="text-xs text-muted-foreground leading-snug flex gap-1.5">
            <span className="text-primary">•</span><span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
