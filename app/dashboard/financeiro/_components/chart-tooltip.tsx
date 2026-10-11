"use client";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

type TooltipRow = { label: string; cents: number; color: string };

type ChartTooltipProps = {
  active?: boolean;
  title: string;
  rows: TooltipRow[];
};

/** Conteúdo padrão de tooltip dos gráficos: título + uma linha por série, valores no modo privacidade. */
export function ChartTooltip({ active, title, rows }: ChartTooltipProps) {
  const { formatValor } = useFinanceiroPrivacy();
  if (!active || rows.length === 0) return null;

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: row.color }} />
            {row.label}
          </span>
          <span className="font-mono font-medium tabular-nums">{formatValor(row.cents / 100)}</span>
        </div>
      ))}
    </div>
  );
}
