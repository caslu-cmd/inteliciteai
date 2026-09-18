import type { ReactNode } from "react";

/**
 * Linguagem visual única para todos os gráficos da plataforma.
 * Paleta derivada da marca (ciano → violeta → teal → âmbar → slate),
 * calma e legível sobre o fundo escuro, sem depender de verde/vermelho
 * para transmitir significado.
 */
export const CHART_COLORS = [
  "hsl(190 95% 52%)", // ciano — marca
  "hsl(265 85% 66%)", // violeta — acento
  "hsl(160 68% 46%)", // teal
  "hsl(38 92% 60%)",  // âmbar
  "hsl(215 16% 58%)", // slate
];

/** Papéis semânticos fixos (mantêm a leitura consistente entre telas). */
export const CHART_ROLE = {
  impugnacoes: "hsl(38 92% 60%)",   // âmbar — chama atenção, sem o alarme do vermelho
  esclarecimentos: "hsl(190 95% 52%)", // ciano — informação
};

export const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
export const GRID_STROKE = "hsl(var(--border) / 0.6)";

/** Margens padrão que dão respiro e evitam que rótulos/eixos sejam cortados. */
export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 0 } as const;

interface TooltipRow {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/**
 * Tooltip consistente com a superfície dos cards. `format` permite
 * formatar o valor (ex.: moeda) sem reescrever o layout em cada gráfico.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  format = (v) => String(v),
}: {
  active?: boolean;
  label?: ReactNode;
  payload?: TooltipRow[];
  format?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 shadow-card-hover backdrop-blur-sm">
      {label != null && label !== "" && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((row, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto font-semibold text-card-foreground tabular-nums">
              {format(row.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legenda discreta e alinhada, usada abaixo/ao lado dos gráficos. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; value?: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: it.color }} />
          <span className="text-muted-foreground">{it.label}</span>
          {it.value && <span className="font-semibold text-card-foreground tabular-nums">{it.value}</span>}
        </div>
      ))}
    </div>
  );
}
