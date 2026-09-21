import { motion } from "framer-motion";
import { RiskBadge } from "./RiskBadge";
import { VictoryScore } from "./VictoryScore";
import { Clock, Building, MapPin, ExternalLink, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface OpportunityCardProps {
  id?: string;
  title: string;
  organ: string;
  location: string;
  deadline: string;
  score: number;
  risk: "low" | "medium" | "high";
  value?: string;
  modalidade?: string;
  link?: string;
  orgaoCnpj?: string;
  matchReason?: string;
  matchScore?: number;   // nota do Match IA (0–100) contra a empresa; ausente = não calculado
  index?: number;
}

// Faixas do Match IA, em linguagem simples.
function faixaMatch(n: number) {
  if (n >= 70) return { rotulo: "Alta aderência", cor: "text-emerald-600 dark:text-emerald-400" };
  if (n >= 40) return { rotulo: "Aderência média", cor: "text-amber-600 dark:text-amber-400" };
  return { rotulo: "Baixa aderência", cor: "text-muted-foreground" };
}

export function OpportunityCard({
  id, title, organ, location, deadline, score, risk,
  value, modalidade, link, orgaoCnpj, matchReason, matchScore, index = 0,
}: OpportunityCardProps) {
  const temMatch = typeof matchScore === "number";
  const faixa = temMatch ? faixaMatch(matchScore) : null;
  const navigate = useNavigate();

  const goToScanner = () =>
    navigate("/licitante/scanner", {
      state: { id, title, organ, location, deadline, score, risk, value, modalidade, link, orgaoCnpj },
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      whileHover={{ scale: 1.01 }}
      className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <RiskBadge level={risk} />
        {value && <span className="text-xs font-mono text-muted-foreground">{value}</span>}
      </div>

      <h3 className="font-semibold text-sm text-card-foreground leading-snug mb-2 line-clamp-2">{title}</h3>

      {temMatch && matchReason && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5">
          <Target className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <span className="text-[11px] leading-snug text-primary/90">
            <strong>{matchScore}% match</strong> — {matchReason}
          </span>
        </div>
      )}

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{organ}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span>{location}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" /><span>{deadline}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        {/* Só mostramos nota quando é o Match IA contra a empresa da pessoa.
            A nota genérica (prazo/valor) não é exibida: parecia "chance de vitória". */}
        {temMatch && faixa ? (
          <div className="flex items-center gap-2.5" title={`${matchScore}% de aderência ao perfil da sua empresa (Match IA)`}>
            <VictoryScore score={matchScore} size={52} />
            <span className={`text-[11px] leading-tight max-w-[84px] font-medium ${faixa.cor}`}>
              {faixa.rotulo} à sua empresa
            </span>
          </div>
        ) : (
          <span className="text-[11px] leading-tight text-muted-foreground max-w-[120px]">
            Match IA não calculado
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir no PNCP (se o portal mostrar erro, ele está instável — tente de novo em instantes)">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={goToScanner}>
            Analisar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
