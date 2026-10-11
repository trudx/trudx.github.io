"use client";

//* Components Imports
import { FinanceiroCartao } from "./financeiro-cartao";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { DashboardModel } from "@/lib/financeiro/dashboard";

//* Utils Imports
import { formatPct } from "@/lib/financeiro/format";

type ComparativoCardProps = {
  model: DashboardModel;
  categoryName: (id: string | null) => string;
};

export function ComparativoCard({ model, categoryName }: ComparativoCardProps) {
  const { formatValor } = useFinanceiroPrivacy();
  const previous = model.previousTotals;
  const comparedCurrent = model.comparedTotals;
  const rows = [
    {
      label: "Receitas",
      now: comparedCurrent.receitas,
      before: previous.receitas,
      change: model.receitasVar,
    },
    {
      label: "Despesas",
      now: comparedCurrent.despesas,
      before: previous.despesas,
      change: model.despesasVar,
    },
    {
      label: "Resultado",
      now: comparedCurrent.resultado,
      before: previous.resultado,
      change: model.resultadoVar,
    },
  ];
  const increased = model.changes.filter((change) => change.abs > 0).slice(0, 3);
  const decreased = model.changes.filter((change) => change.abs < 0).slice(0, 3);

  return (
    <FinanceiroCartao title="Comparação com o período anterior" subtitle={model.comparison.label}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium" />
              <th className="pb-2 text-right font-medium">Atual</th>
              <th className="pb-2 text-right font-medium">Anterior</th>
              <th className="pb-2 text-right font-medium">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <th scope="row" className="py-2 text-left font-medium">
                  {row.label}
                </th>
                <td className="py-2 text-right tabular-nums">{formatValor(row.now / 100)}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {formatValor(row.before / 100)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  <span className="block">{formatPct(row.change.pct, row.now)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.change.abs > 0 ? "+" : ""}
                    {formatValor(row.change.abs / 100)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(increased.length > 0 || decreased.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Categorias que aumentaram", list: increased },
            { title: "Categorias que diminuíram", list: decreased },
          ].map(({ title, list }) => (
            <div key={title}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {list.map((change) => (
                    <li key={change.categoriaId ?? "none"} className="flex justify-between gap-2">
                      <span className="truncate">{categoryName(change.categoriaId)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {change.abs > 0 ? "+" : ""}
                        {formatValor(change.abs / 100)} ({formatPct(change.pct, change.atual)})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </FinanceiroCartao>
  );
}
