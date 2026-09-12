import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Scale, Gavel, Loader2, AlertTriangle, CheckCircle2, ShieldAlert,
  XCircle, FileText, Clock, ListChecks, Sparkles, BookOpen, Radio, Info, Building2, MessageSquareText, Paperclip,
} from "lucide-react";

interface Achado {
  item?: string; trecho?: string; categoria?: string; gravidade?: string;
  problema?: string; fundamento?: string; fonte?: string; url?: string; acao?: string;
}
interface Prazo { evento?: string; dataLimite?: string; baseLegal?: string; premissa?: string; }
interface Fonte { rotulo: string; url?: string; }
interface Identificacao { documento?: string; orgao?: string; objeto?: string; regime?: string; datasChave?: string[]; naoAnalisado?: string[]; }
interface Parecer {
  identificacao?: Identificacao;
  sumarioExecutivo?: string;
  veredito?: string;
  achados?: Achado[];
  prazos?: Prazo[];
  naoVerificado?: string[];
  fontes?: Fonte[];
  recomendacaoFinal?: string;
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
  assinar_com_ressalvas:    { label: "Assinar com ressalvas", cls: "bg-amber-400/10 text-amber-600 border-amber-400/25", Icon: ShieldAlert },
  impugnar:                 { label: "Impugnar", cls: "bg-orange-500/10 text-orange-600 border-orange-500/25", Icon: Gavel },
  recorrer:                 { label: "Recorrer", cls: "bg-orange-500/10 text-orange-600 border-orange-500/25", Icon: Gavel },
  nao_recomendado:          { label: "Não recomendado", cls: "bg-destructive/10 text-destructive border-destructive/25", Icon: XCircle },
};

const CATEGORIA: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  ilegalidade: { label: "Ilegalidade", cls: "bg-destructive/10 text-destructive border-destructive/25", Icon: XCircle },
  risco:       { label: "Risco",       cls: "bg-orange-500/10 text-orange-600 border-orange-500/25", Icon: AlertTriangle },
  impugnacao:  { label: "Impugnação",  cls: "bg-amber-400/10 text-amber-600 border-amber-400/25", Icon: Gavel },
  recurso:     { label: "Recurso",     cls: "bg-amber-400/10 text-amber-600 border-amber-400/25", Icon: Gavel },
  observacao:  { label: "Observação",  cls: "bg-muted text-muted-foreground border-border", Icon: Info },
};

const GRAV: Record<string, string> = {
  alta:  "bg-destructive/10 text-destructive",
  media: "bg-amber-400/10 text-amber-600",
  baixa: "bg-muted text-muted-foreground",
};

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

export default function ParecerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [parecer, setParecer] = useState<Parecer | null>(null);

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
    } catch (err: any) {
      toast({ title: "Não foi possível gerar o parecer", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const v = parecer?.veredito ? VEREDITO[parecer.veredito] : null;
  const id = parecer?.identificacao;

  return (
    <LicitanteLayout>
      <div className="p-6 lg:p-8 max-w-[1100px] mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3" /> Intelicite
              </p>
              <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
                <Scale className="w-6 h-6 text-primary" /> Parecer Jurídico
              </h1>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 flex-shrink-0" onClick={() => navigate("/licitante/assistente")}>
              <MessageSquareText className="w-4 h-4" /> <span className="hidden sm:inline">Tirar dúvidas no chat</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            É a mesma IA do chat Intelicite, em <strong>modo parecer</strong>: cole um edital, sua proposta/habilitação
            ou um contrato e ela analisa como um advogado sênior — nada é afirmado sem fonte, com trecho literal,
            classificação por gravidade e prazos.
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
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9}
              placeholder="Cole aqui o texto do edital, da sua proposta/habilitação ou do contrato..." className="text-xs" />
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
            <p className="text-sm text-muted-foreground">O Advogado IA está lendo o documento e consultando a base + jurisprudência ao vivo...</p>
          </div>
        )}

        {parecer && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Identificação + veredito */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {v && (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${v.cls}`}>
                    <v.Icon className="w-4 h-4" /> {v.label}
                  </span>
                )}
                {id?.documento && <span className="text-xs text-muted-foreground capitalize">{id.documento}</span>}
                {id?.regime && <span className="text-[11px] text-muted-foreground">· {id.regime}</span>}
              </div>
              {(id?.orgao || id?.objeto) && (
                <div className="text-xs text-muted-foreground space-y-1 mb-2">
                  {id?.orgao && <p className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />{id.orgao}</p>}
                  {id?.objeto && <p>{id.objeto}</p>}
                </div>
              )}
              {parecer.sumarioExecutivo && (
                <p className="text-sm text-card-foreground leading-relaxed border-t border-border pt-3">{parecer.sumarioExecutivo}</p>
              )}
              {id?.datasChave?.length ? (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {id.datasChave.map((d, i) => (
                    <span key={i} className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{d}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Achados */}
            {parecer.achados?.length ? (
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-4">
                  <ListChecks className="w-4 h-4 text-primary" /> Achados ({parecer.achados.length})
                </p>
                <div className="space-y-4">
                  {parecer.achados.map((a, i) => {
                    const cat = CATEGORIA[a.categoria || "observacao"] || CATEGORIA.observacao;
                    const href = linkDaFonte(a.fonte || a.fundamento, a.url);
                    return (
                      <div key={i} className="border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cat.cls}`}>
                            <cat.Icon className="w-3 h-3" /> {cat.label}
                          </span>
                          {a.gravidade && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${GRAV[a.gravidade] || GRAV.baixa}`}>
                              {a.gravidade}
                            </span>
                          )}
                          {a.item && <span className="text-[11px] text-muted-foreground">{a.item}</span>}
                        </div>
                        {a.trecho && (
                          <p className="text-xs italic text-muted-foreground border-l-2 border-border pl-2 my-1.5">"{a.trecho}"</p>
                        )}
                        {a.problema && <p className="text-sm text-card-foreground leading-relaxed">{a.problema}</p>}
                        {a.acao && <p className="text-xs text-foreground mt-1.5"><strong>Ação:</strong> {a.acao}</p>}
                        {(a.fonte || a.fundamento) && (
                          href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-1">
                              <Paperclip className="h-3 w-3" /> {a.fonte || a.fundamento}
                            </a>
                          ) : (
                            <p className="text-[11px] text-primary/80 mt-1 inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {a.fonte || a.fundamento}</p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Prazos */}
            {parecer.prazos?.length ? (
              <div className="bg-card rounded-xl border border-border p-5 shadow-card">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
                  <Clock className="w-4 h-4 text-primary" /> Prazos
                </p>
                <div className="space-y-2">
                  {parecer.prazos.map((p, i) => (
                    <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-baseline gap-x-3 border-b border-border last:border-0 pb-2 last:pb-0">
                      <span className="font-medium text-card-foreground sm:w-48 flex-shrink-0">{p.evento}</span>
                      <span className="text-foreground">{p.dataLimite}</span>
                      <span className="text-muted-foreground">{[p.baseLegal, p.premissa].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Recomendação */}
            {parecer.recomendacaoFinal && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" /> Recomendação final
                </p>
                <p className="text-sm text-card-foreground leading-relaxed">{parecer.recomendacaoFinal}</p>
              </div>
            )}

            {/* Não verificado */}
            {parecer.naoVerificado?.length ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Não verificado / limitações
                </p>
                <ul className="space-y-1">
                  {parecer.naoVerificado.map((n, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span>•</span><span>{n}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Não analisado (anexos ausentes) */}
            {id?.naoAnalisado?.length ? (
              <div className="text-xs text-muted-foreground">
                <strong>Não analisado (não enviado):</strong> {id.naoAnalisado.join("; ")}
              </div>
            ) : null}

            {/* Fontes (recolhível) */}
            {(() => {
              const brutas: Fonte[] = parecer.fontes?.length
                ? parecer.fontes
                : (parecer.achados || []).map((a) => ({ rotulo: a.fonte || a.fundamento || "", url: a.url }));
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
              <Scale className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Análise técnica de apoio, com base na legislação indexada e na <strong>jurisprudência do TCU/AGU buscada ao vivo</strong>.
              Não substitui a revisão e assinatura de advogado(a) inscrito(a) na OAB responsável pelo caso. Confira as fontes antes de decidir.
            </p>
          </motion.div>
        )}

        {!parecer && !loading && (
          <p className="text-center text-xs text-muted-foreground/50 mt-8">
            O parecer aponta ilegalidades, riscos e pontos de impugnação/recurso — cada um com a fonte citada.
          </p>
        )}
      </div>
    </LicitanteLayout>
  );
}
