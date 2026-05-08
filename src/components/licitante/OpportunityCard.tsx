import { motion } from "framer-motion";
import { RiskBadge } from "./RiskBadge";
import { VictoryScore } from "./VictoryScore";
import { Clock, Building, MapPin, ExternalLink } from "lucide-react";
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
  index?: number;
}

export function OpportunityCard({
  id, title, organ, location, deadline, score, risk,
  value, modalidade, link, orgaoCnpj, index = 0,
}: OpportunityCardProps) {
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

      <h3 className="font-semibold text-sm text-card-foreground leading-snug mb-3 line-clamp-2 flex-1">{title}</h3>

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
        <VictoryScore score={score} size={52} />
        <div className="flex items-center gap-1.5">
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir no PNCP">
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
