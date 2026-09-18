import { motion } from "framer-motion";

interface VictoryScoreProps {
  score: number;
  size?: number;
}

export function VictoryScore({ score, size = 140 }: VictoryScoreProps) {
  // Tudo proporcional ao tamanho para o texto nunca estourar o anel.
  const strokeWidth = Math.max(4, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  const showLabel = size >= 88; // só mostra "Chance" quando há espaço real
  const valueFontSize = Math.round(size * (showLabel ? 0.26 : 0.3));
  const labelFontSize = Math.round(size * 0.1);

  const color =
    score >= 70 ? "hsl(var(--success))" :
    score >= 40 ? "hsl(43 96% 56%)" :
    "hsl(var(--destructive))";

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <motion.span
          className="font-display font-bold text-card-foreground tabular-nums"
          style={{ fontSize: valueFontSize }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}%
        </motion.span>
        {showLabel && (
          <span className="text-muted-foreground mt-1" style={{ fontSize: labelFontSize }}>Chance</span>
        )}
      </div>
    </div>
  );
}
