import { motion } from "framer-motion";
import { RiskBadge } from "./RiskBadge";
import { VictoryScore } from "./VictoryScore";
import { Clock, Building, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface OpportunityCardProps {
  title: string;
  organ: string;
  location: string;
  deadline: string;
  score: number;
  risk: "low" | "medium" | "high";
  value?: string;
  index?: number;
}

export function OpportunityCard({ title, organ, location, deadline, score, risk, value, index = 0 }: OpportunityCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      whileHover={{ scale: 1.01 }}
      className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <RiskBadge level={risk} />
        {value && <span className="text-xs font-mono-legal text-muted-foreground">{value}</span>}
      </div>
      <h3 className="font-semibold text-sm text-card-foreground leading-snug mb-2 line-clamp-2">{title}</h3>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building className="w-3.5 h-3.5" /><span>{organ}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" /><span>{location}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /><span>{deadline}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <VictoryScore score={score} size={56} />
        <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/licitante/scanner")}>
          Analisar edital
        </Button>
      </div>
    </motion.div>
  );
}
