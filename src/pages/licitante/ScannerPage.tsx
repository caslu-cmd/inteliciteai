import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { LicitanteLayout } from "@/components/licitante/LicitanteLayout";
import { RiskBadge } from "@/components/licitante/RiskBadge";
import { VictoryScore } from "@/components/licitante/VictoryScore";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  FileUp, Clock, FileCheck, AlertTriangle, Scale, FileText,
  HelpCircle, Radar as RadarIcon, ChevronDown, Loader2,
  Upload, X, ExternalLink, RotateCcw,
} from "lucide-react";

interface Analysis {
  score: number;
  riskLevel: "low" | "medium" | "high";
  summary: { objeto: string; modalidade: string; valorEstimado: string; orgao: string; numero: string };
  prazos: { label: string; date: string; status: "past" | "urgent" | "upcoming" | "future" }[];
  habilitacao: { categoria: string; status: "apto" | "risco" | "nao_atende"; itens: string[] }[];
  riscos: { level: "low" | "medium" | "high"; title: string; ref: string; excerpt: string }[];
  recomendacoes: string[];
}

const statusMap = {
  apto:       { label: "Apto",        className: "bg-success/10 text-success border-success/20"              },
  risco:      { label: "Risco Médio", className: "bg-amber-400/10 text-amber-400 border-amber-400/20"       },
  nao_atende: { label: "Não Atende",  className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const prazoColor = {
  past:     "bg-muted-foreground/40",
  urgent:   "bg-destructive animate-pulse",
  upcoming: "bg-amber-400",
  future:   "bg-muted-foreground/30",
};

export default function ScannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"upload" | "analyzing" | "done" | "error">("upload");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = useState<string[]>(["resumo", "riscos"]);
  const [dragging, setDragging] = useState(false);

  const toggle = (id: string) =>
    setExpanded((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id]);

  const processFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMsg("Selecione um arquivo PDF.");
      setPhase("error");
      return;
    }
    setFilename(file.name);
    setPdfUrl(URL.createObjectURL(file));
    setPhase("analyzing");
    setErrorMsg("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-edital`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ pdfBase64, filename: file.name }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);

      setAnalysis(json);
      setPhase("done");
      setExpanded(["resumo", "riscos"]);
    } catch (err: any) {
      setErrorMsg(err.message || "Falha ao analisar edital");
      setPhase("error");
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setAnalysis(null);
    setFilename("");
    setPhase("upload");
    setErrorMsg("");
  };

  // Upload / Error screen
  if (phase === "upload" || phase === "error") {
    return (
      <LicitanteLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-lg w-full">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all ${
                dragging
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-5 flex items-center justify-center">
                <FileUp className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground mb-2">
                Analisar Edital com IA
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                Arraste o PDF ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground/60">
                Intelicite IA analisa o edital completo em segundos — Lei 14.133/2021
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />

            {phase === "error" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-4 text-sm text-destructive flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />{errorMsg}
              </motion.p>
            )}
          </motion.div>
        </div>
      </LicitanteLayout>
    );
  }

  // Analyzing screen
  if (phase === "analyzing") {
    return (
      <LicitanteLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] gap-6">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="font-display font-bold text-lg text-foreground mb-1">Analisando Edital</h2>
            <p className="text-sm text-muted-foreground">{filename}</p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground text-center">
            {["Lendo o documento PDF...", "Identificando cláusulas e exigências...", "Verificando conformidade com Lei 14.133/2021...", "Calculando score e riscos..."].map((step, i) => (
              <motion.p key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 1.2 }}>
                {step}
              </motion.p>
            ))}
          </div>
        </div>
      </LicitanteLayout>
    );
  }

  // Results screen
  return (
    <LicitanteLayout>
      <div className="h-screen flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate max-w-xs" title={filename}>{filename}</p>
            {analysis && <RiskBadge level={analysis.riskLevel} />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/minutas")}>
              <FileText className="w-3.5 h-3.5" /> Impugnação
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/minutas")}>
              <HelpCircle className="w-3.5 h-3.5" /> Esclarecimento
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/licitante/habilitacao")}>
              <Scale className="w-3.5 h-3.5" /> Habilitação
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset} title="Novo edital">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF viewer */}
          <div className="w-[58%] border-r border-border bg-muted/30 flex flex-col">
            {pdfUrl ? (
              <iframe src={pdfUrl} className="flex-1 w-full" title="Edital PDF" />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                PDF não disponível
              </div>
            )}
          </div>

          {/* Analysis panel */}
          <div className="w-[42%] overflow-y-auto">
            {/* Score header */}
            <div className="p-5 border-b border-border bg-card">
              <div className="flex items-center gap-4">
                <VictoryScore score={analysis?.score ?? 0} size={76} />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Chance de Vitória</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Baseado em complexidade, exigências, prazos e valor estimado
                  </p>
                  {analysis?.recomendacoes?.length ? (
                    <p className="text-xs text-primary mt-1.5">
                      {analysis.recomendacoes[0]}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Sections */}
            {[
              { id: "resumo",     title: "Resumo",               icon: FileCheck    },
              { id: "prazos",     title: "Prazos Importantes",   icon: Clock        },
              { id: "habilitacao",title: "Habilitação",           icon: Scale        },
              { id: "riscos",     title: "Riscos Identificados",  icon: AlertTriangle },
            ].map(({ id, title, icon: Icon }) => {
              const open = expanded.includes(id);
              return (
                <div key={id} className="border-b border-border">
                  <button onClick={() => toggle(id)}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-sm text-card-foreground flex-1 text-left">{title}</span>
                    <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5">
                          {id === "resumo" && analysis?.summary && (
                            <div className="space-y-2.5">
                              {Object.entries(analysis.summary).map(([k, v]) => (
                                <div key={k} className="flex items-start gap-2">
                                  <span className="text-xs text-muted-foreground min-w-[90px] capitalize">
                                    {k.replace(/([A-Z])/g, " $1")}
                                  </span>
                                  <span className="text-sm text-card-foreground">{v}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {id === "prazos" && analysis?.prazos && (
                            <div className="space-y-2">
                              {analysis.prazos.map((p, i) => (
                                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${prazoColor[p.status]}`} />
                                  <span className="text-sm text-card-foreground flex-1">{p.label}</span>
                                  <span className="text-xs font-mono text-muted-foreground">{p.date}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {id === "habilitacao" && analysis?.habilitacao && (
                            <div className="space-y-3">
                              {analysis.habilitacao.map((cat, i) => (
                                <div key={i} className="p-3 rounded-lg border border-border">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-card-foreground">{cat.categoria}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusMap[cat.status].className}`}>
                                      {statusMap[cat.status].label}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {cat.itens.map((item, j) => (
                                      <span key={j} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{item}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {id === "riscos" && analysis?.riscos && (
                            <div className="space-y-3">
                              {analysis.riscos.length === 0 ? (
                                <p className="text-sm text-success flex items-center gap-2">
                                  <FileCheck className="w-4 h-4" /> Nenhum risco crítico identificado.
                                </p>
                              ) : (
                                analysis.riscos.map((r, i) => (
                                  <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08 }} className="p-3 rounded-lg border border-border">
                                    <div className="flex items-start gap-2 mb-1.5">
                                      <RiskBadge level={r.level} />
                                      <span className="text-sm font-medium text-card-foreground leading-snug">{r.title}</span>
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground mb-1">{r.ref}</p>
                                    {r.excerpt && (
                                      <p className="text-xs text-muted-foreground italic line-clamp-2">"{r.excerpt}"</p>
                                    )}
                                  </motion.div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Recommendations */}
            {analysis?.recomendacoes && analysis.recomendacoes.length > 1 && (
              <div className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recomendações</p>
                <ul className="space-y-2">
                  {analysis.recomendacoes.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-card-foreground">
                      <span className="text-primary mt-0.5">→</span>{rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </LicitanteLayout>
  );
}
