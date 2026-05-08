import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "success" | "warning" | "destructive";
}

const variantBorder = {
  default:     "border-border",
  success:     "border-success/30",
  warning:     "border-amber-400/30",
  destructive: "border-destructive/30",
};

const variantIcon = {
  default:     "bg-primary/10 text-primary",
  success:     "bg-success/10 text-success",
  warning:     "bg-amber-400/10 text-amber-400",
  destructive: "bg-destructive/10 text-destructive",
};

const variantStroke = {
  default:     "hsl(var(--primary))",
  success:     "hsl(var(--success))",
  warning:     "hsl(43 96% 56%)",
  destructive: "hsl(var(--destructive))",
};

export function KpiCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className={cn("bg-card rounded-xl border p-5 shadow-card transition-shadow", variantBorder[variant])}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", variantIcon[variant])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
            trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <div className="font-display font-bold text-2xl text-card-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      <div className="mt-3 h-8 w-full">
        <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
          <motion.path
            d="M0,25 Q10,20 20,22 T40,15 T60,18 T80,8 T100,12"
            fill="none"
            stroke={variantStroke[variant]}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
          />
        </svg>
      </div>
    </motion.div>
  );
}
