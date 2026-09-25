import { ShieldCheck, ShieldAlert } from "lucide-react";
import { MensagemMarkdown } from "@/components/MensagemMarkdown";
import type { VerificacaoIA } from "@/lib/lerStreamIA";

// Resultado da conferência automática das citações do documento gerado. Fica fora
// do texto do documento (não entra no que é salvo nem exportado).
export function PainelVerificacao({ v }: { v: VerificacaoIA | null }) {
  if (!v?.markdown) return null;
  const falha = v.citacoes?.some((c) => c.status === "nao_confere") || v.normas?.some((n) => !n.ok);
  const Icon = falha ? ShieldAlert : ShieldCheck;
  return (
    <div className={`mt-4 rounded-lg border p-4 text-xs ${falha ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
      <p className={`font-semibold flex items-center gap-1.5 mb-2 ${falha ? "text-red-400" : "text-emerald-400"}`}>
        <Icon className="h-4 w-4" />
        {falha ? "Citações que não conferiam com a lei foram REMOVIDAS do documento (marcadas entre colchetes): revise esses pontos" : "Citações conferidas no texto oficial da lei"}
      </p>
      <MensagemMarkdown className="text-muted-foreground">{v.markdown.replace(/^\*\*🔎[^\n]*\*\*\s*/, "")}</MensagemMarkdown>
      <p className="mt-2 text-[10px] text-muted-foreground/70">Conferência feita por código na íntegra oficial indexada. Este painel não entra no documento salvo nem exportado.</p>
    </div>
  );
}
