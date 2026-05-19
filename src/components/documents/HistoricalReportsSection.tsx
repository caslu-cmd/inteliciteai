import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, X, Sparkles, Loader2, ChevronDown, ChevronUp,
  Check, TrendingUp, AlertTriangle, DollarSign, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export type ForecastData = {
  narrativa: string;
  itens: { descricao: string; quantidade: number; unidade: string; valorUnitario: number }[];
  valorTotal: number;
  tendencias: string[];
  riscos: string[];
  medidasMitigacao: string[];
  justificativa: string;
  requisitos: string[];
  objeto: string;
};

type UploadedReport = {
  id: string;
  ano: number;
  fileName: string;
  texto: string;
  size: number;
};

type AccentKey = "amber" | "blue" | "green";

type Props = {
  onApply: (data: ForecastData) => void;
  documentType: "etp" | "tr" | "dfd";
  orgao?: string;
  accent?: AccentKey;
};

const ACCENTS: Record<AccentKey, { bg: string; text: string; border: string; btn: string; bar: string }> = {
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", btn: "bg-amber-500 hover:bg-amber-600", bar: "bg-amber-500" },
  blue:  { bg: "bg-blue-500/10",  text: "text-blue-500",  border: "border-blue-500/30",  btn: "bg-blue-600 hover:bg-blue-700",  bar: "bg-blue-500"  },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30", btn: "bg-emerald-500 hover:bg-emerald-600", bar: "bg-emerald-500" },
};

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n").trim();
}

export default function HistoricalReportsSection({ onApply, documentType, orgao = "", accent = "amber" }: Props) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [applied, setApplied] = useState(false);

  const a = ACCENTS[accent];
  const anoAlvo = new Date().getFullYear() + 1;

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name}: apenas PDFs são suportados`);
        continue;
      }
      setExtracting(file.name);
      try {
        const texto = await extractTextFromPdf(file);
        const yearMatch = file.name.match(/20\d{2}/);
        const ano = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() - 1;
        setReports(prev => [...prev, { id: crypto.randomUUID(), ano, fileName: file.name, texto, size: file.size }]);
      } catch {
        toast.error(`Erro ao extrair texto de ${file.name}`);
      } finally {
        setExtracting(null);
      }
    }
  }, []);

  const removeReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    setForecast(null);
    setApplied(false);
  };

  const handleGenerate = async () => {
    if (reports.length === 0) { toast.error("Adicione pelo menos um relatório"); return; }
    setGenerating(true);
    setForecast(null);
    setApplied(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          tipo: "previsao-anual",
          formData: {
            relatorios: reports.map(r => ({ ano: r.ano, texto: r.texto.slice(0, 8000) })),
            orgao,
            anoAlvo,
            tipoDocumento: documentType,
          },
        }),
      });
      if (!res.ok) throw new Error("Falha ao gerar previsão");
      const raw = await res.text();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Resposta inválida");
      const data: ForecastData = JSON.parse(match[0]);
      setForecast(data);
      toast.success("Previsão gerada! Clique em 'Aplicar ao formulário'.");
    } catch {
      toast.error("Erro ao gerar previsão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyAll = () => {
    if (!forecast) return;
    onApply(forecast);
    setApplied(true);
    toast.success("Previsão aplicada ao formulário!");
  };

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", open ? a.border : "border-border")}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", a.bg)}>
            <TrendingUp className={cn("h-4 w-4", a.text)} />
          </div>
          <div>
            <p className="text-sm font-semibold">Relatórios Históricos + Previsão IA</p>
            <p className="text-xs text-muted-foreground">
              {reports.length > 0
                ? `${reports.length} relatório(s) · ${forecast ? "Previsão pronta" : "Pronto para analisar"}`
                : "Anexe relatórios anuais para gerar previsão inteligente do próximo exercício"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reports.length > 0 && (
            <Badge variant="secondary" className="text-xs">{reports.length} arquivo{reports.length !== 1 ? "s" : ""}</Badge>
          )}
          {forecast && (
            <Badge className={cn("text-xs text-white", a.btn.split(" ")[0])}>
              {applied ? "Aplicado" : "Previsão pronta"}
            </Badge>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border space-y-4">
              {/* Upload area */}
              <label className={cn(
                "mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                extracting ? "border-muted cursor-default" : cn("hover:border-current", a.text, "border-border"),
              )}>
                <input
                  type="file" multiple accept=".pdf"
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                  disabled={!!extracting}
                />
                {extracting ? (
                  <>
                    <Loader2 className={cn("h-6 w-6 animate-spin mb-2", a.text)} />
                    <p className="text-xs text-muted-foreground">Extraindo texto de {extracting}…</p>
                  </>
                ) : (
                  <>
                    <Upload className={cn("h-6 w-6 mb-2", a.text)} />
                    <p className="text-sm font-medium">Clique ou arraste PDFs aqui</p>
                    <p className="text-xs text-muted-foreground mt-1">Relatórios anuais, prestações de contas, balancetes</p>
                  </>
                )}
              </label>

              {/* List of uploaded reports */}
              {reports.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Relatórios carregados</p>
                  {reports.map(r => (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <FileText className={cn("h-4 w-4 shrink-0", a.text)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{r.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Ano: {r.ano} · {Math.round(r.size / 1024)} KB · {r.texto.length.toLocaleString()} chars extraídos
                        </p>
                      </div>
                      <button onClick={() => removeReport(r.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Generate button */}
              {reports.length > 0 && (
                <Button
                  className={cn("w-full text-white gap-2", a.btn)}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating
                    ? "Analisando relatórios e gerando previsão…"
                    : forecast
                    ? `Regenerar Previsão para ${anoAlvo}`
                    : `Gerar Previsão para ${anoAlvo}`}
                </Button>
              )}

              {/* Forecast result */}
              {forecast && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Previsão para {anoAlvo}
                    </p>
                    <Button
                      size="sm"
                      className={cn("h-7 text-xs text-white gap-1.5", a.btn)}
                      onClick={handleApplyAll}
                    >
                      {applied ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {applied ? "Aplicado ao formulário" : "Aplicar ao formulário"}
                    </Button>
                  </div>

                  {/* Narrative */}
                  {forecast.narrativa && (
                    <div className={cn("rounded-lg border p-3 text-xs", a.border, a.bg)}>
                      <div className="prose prose-sm max-w-none dark:prose-invert [&>*]:text-xs [&>h1]:text-xs [&>h2]:text-xs [&>h3]:text-xs [&>p]:leading-relaxed">
                        <ReactMarkdown>{forecast.narrativa}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {forecast.itens?.length > 0 && (
                      <ForecastCard icon={<ClipboardList className="h-3.5 w-3.5" />} title="Itens Previstos" accent={a}>
                        <div className="space-y-1">
                          {forecast.itens.slice(0, 5).map((item, i) => (
                            <p key={i} className="text-[10px]">
                              <span className="font-medium">{item.descricao}</span>
                              {" — "}{item.quantidade} {item.unidade}
                              {item.valorUnitario > 0 && ` · R$ ${item.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                            </p>
                          ))}
                          {forecast.itens.length > 5 && (
                            <p className="text-[10px] text-muted-foreground">+{forecast.itens.length - 5} itens</p>
                          )}
                        </div>
                      </ForecastCard>
                    )}

                    {forecast.valorTotal > 0 && (
                      <ForecastCard icon={<DollarSign className="h-3.5 w-3.5" />} title="Estimativa de Valor" accent={a}>
                        <p className="text-lg font-bold">
                          R$ {forecast.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Com base nos históricos informados</p>
                      </ForecastCard>
                    )}

                    {forecast.tendencias?.length > 0 && (
                      <ForecastCard icon={<TrendingUp className="h-3.5 w-3.5" />} title="Tendências Observadas" accent={a}>
                        <ul className="space-y-0.5">
                          {forecast.tendencias.slice(0, 4).map((t, i) => (
                            <li key={i} className="text-[10px] flex gap-1.5">
                              <span className={cn("shrink-0 font-bold", a.text)}>↑</span>{t}
                            </li>
                          ))}
                        </ul>
                      </ForecastCard>
                    )}

                    {forecast.riscos?.length > 0 && (
                      <ForecastCard icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Riscos Identificados" accent={a}>
                        <ul className="space-y-0.5">
                          {forecast.riscos.slice(0, 4).map((r, i) => (
                            <li key={i} className="text-[10px] flex gap-1.5">
                              <span className="text-orange-500 shrink-0">•</span>{r}
                            </li>
                          ))}
                        </ul>
                      </ForecastCard>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ForecastCard({
  icon, title, accent, children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: { bg: string; text: string; border: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
      <div className={cn("flex items-center gap-1.5 text-xs font-semibold", accent.text)}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
