"use client";

//* Components Imports
import ChartContainer from "@/components/ui/chart";

import { ChartLegend } from "./chart-legend";
import { ChartTooltip } from "./chart-tooltip";

//* Libraries Imports
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { Granularity, SeriesPoint } from "@/lib/financeiro/analytics";
import type { ChartConfig } from "@/components/ui/chart";

//* Constants Imports
import { CHART_COLORS } from "@/lib/financeiro/chart-colors";

//* Utils Imports
import { bucketLabel, bucketTitle } from "@/lib/financeiro/format";

type ReceitasDespesasChartProps = {
  series: SeriesPoint[];
  granularity: Granularity;
};

const config = {
  receitas: { label: "Receitas", theme: CHART_COLORS.receitas },
  despesas: { label: "Despesas", theme: CHART_COLORS.despesas },
} satisfies ChartConfig;

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function ReceitasDespesasChart({ series, granularity }: ReceitasDespesasChartProps) {
  const { isHidden, formatValor } = useFinanceiroPrivacy();
  const data = series.map((point) => ({
    key: point.key,
    receitas: point.receitas / 100,
    despesas: point.despesas / 100,
  }));
  const unit = granularity === "dia" ? "dia" : granularity === "semana" ? "semana" : "mês";

  return (
    <div>
      <ChartLegend
        items={[
          { label: "Receitas", color: CHART_COLORS.receitas.light },
          { label: "Despesas", color: CHART_COLORS.despesas.light },
        ]}
      />
      <div role="img" aria-label={`Receitas e despesas por ${unit}`}>
        <ChartContainer.ChartContainerRoot
          config={config}
          className="aspect-auto h-64 w-full sm:h-72"
        >
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              tickFormatter={(key: string) => bucketLabel(key, granularity)}
            />
            <YAxis
              width={isHidden ? 8 : 48}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => (isHidden ? "" : compact.format(value))}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  | { key: string; receitas: number; despesas: number }
                  | undefined;
                if (!point) return null;
                return (
                  <ChartTooltip
                    active={active}
                    title={bucketTitle(point.key, granularity)}
                    rows={[
                      {
                        label: "Receitas",
                        cents: Math.round(point.receitas * 100),
                        color: CHART_COLORS.receitas.light,
                      },
                      {
                        label: "Despesas",
                        cents: Math.round(point.despesas * 100),
                        color: CHART_COLORS.despesas.light,
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="receitas"
              fill="var(--color-receitas)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="despesas"
              fill="var(--color-despesas)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer.ChartContainerRoot>
      </div>
      <table className="sr-only">
        <caption>Receitas e despesas por {unit}</caption>
        <thead>
          <tr>
            <th>Período</th>
            <th>Receitas</th>
            <th>Despesas</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.key}>
              <td>{bucketTitle(point.key, granularity)}</td>
              <td>{formatValor(point.receitas / 100)}</td>
              <td>{formatValor(point.despesas / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
