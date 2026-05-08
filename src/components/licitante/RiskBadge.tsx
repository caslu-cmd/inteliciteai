import { cn } from "@/lib/utils";

type RiskLevel = "low" | "medium" | "high";

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

const riskStyles: Record<RiskLevel, string> = {
  low:    "bg-success/10 text-success border-success/20",
  medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  high:   "bg-destructive/10 text-destructive border-destructive/20",
};

const riskLabels: Record<RiskLevel, string> = {
  low:    "Baixo",
  medium: "Médio",
  high:   "Alto",
};

const dotStyles: Record<RiskLevel, string> = {
  low:    "bg-success",
  medium: "bg-amber-400",
  high:   "bg-destructive",
};

export function RiskBadge({ level, label, className }: RiskBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", riskStyles[level], className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse-glow", dotStyles[level])} />
      {label || riskLabels[level]}
    </span>
  );
}
