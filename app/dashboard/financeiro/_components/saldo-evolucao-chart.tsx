"use client";

//* Components Imports
import ChartContainer from "@/components/ui/chart";

import { ChartLegend } from "./chart-legend";
import { ChartTooltip } from "./chart-tooltip";

//* Libraries Imports
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { BalancePoint } from "@/lib/financeiro/analytics";
import type { ChartConfig } from "@/components/ui/chart";

//* Constants Imports
import { CHART_COLORS } from "@/lib/financeiro/chart-colors";

//* Utils Imports
import { bucketLabel, bucketTitle } from "@/lib/financeiro/format";

type SaldoEvolucaoChartProps = {
  points: BalancePoint[];
  kind: "bancario" | "calculado";
};

const config = {
  estimado: { label: "Estimado", theme: CHART_COLORS.neutro },
  confirmado: { label: "Confirmado", color: "var(--foreground)" },
} satisfies ChartConfig;

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function SaldoEvolucaoChart({ points, kind }: SaldoEvolucaoChartProps) {
  const { isHidden, formatValor } = useFinanceiroPrivacy();
  const isBancario = kind === "bancario";
  const data = points.map((point) => ({
    date: point.date,
    estimado: point.estimado / 100,
    confirmado: point.confirmado === null ? null : point.confirmado / 100,
  }));

  return (
    <div>
      <ChartLegend
        items={[
          {
            label: isBancario ? "Estimado (inclui provisórios)" : "Saldo calculado do histórico",
            color: CHART_COLORS.neutro.light,
            dashed: true,
          },
          ...(isBancario ? [{ label: "Confirmado pelo extrato", color: "currentColor" }] : []),
        ]}
      />
      {!isBancario && (
        <p className="mb-2 text-xs text-muted-foreground">
          Há bancos sem saldo de referência neste período: a linha é calculada a partir do histórico
          disponível e não representa o saldo bancário validado.
        </p>
      )}
      <div role="img" aria-label="Evolução do saldo acumulado">
        <ChartContainer.ChartContainerRoot
          config={config}
          className="aspect-auto h-64 w-full sm:h-72"
        >
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(key: string) => bucketLabel(key, "dia")}
            />
            <YAxis
              width={isHidden ? 8 : 52}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => (isHidden ? "" : compact.format(value))}
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!point) return null;
                const rows = [
                  {
                    label: "Estimado",
                    cents: Math.round(point.estimado * 100),
                    color: CHART_COLORS.neutro.light,
                  },
                  ...(point.confirmado !== null
                    ? [
                        {
                          label: "Confirmado",
                          cents: Math.round(point.confirmado * 100),
                          color: "currentColor",
                        },
                      ]
                    : []),
                ];
                return (
                  <ChartTooltip
                    active={active}
                    title={bucketTitle(point.date, "dia")}
                    rows={rows}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="estimado"
              stroke="var(--color-estimado)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            {isBancario && (
              <Line
                type="monotone"
                dataKey="confirmado"
                stroke="var(--color-confirmado)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ChartContainer.ChartContainerRoot>
      </div>
      <table className="sr-only">
        <caption>Saldo acumulado por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Estimado</th>
            {isBancario && <th>Confirmado</th>}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{bucketTitle(point.date, "dia")}</td>
              <td>{formatValor(point.estimado / 100)}</td>
              {isBancario && (
                <td>{point.confirmado === null ? "—" : formatValor(point.confirmado / 100)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
