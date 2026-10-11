"use client";

//* Components Imports
import { FinanceiroCartao } from "./financeiro-cartao";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { LedgerRow } from "@/lib/financeiro/types";

//* Utils Imports
import { formatDate } from "@/lib/format-date";

type MaioresDespesasCardProps = {
  rows: LedgerRow[];
  bancoName: (id: string | null) => string;
  onSelect: (id: string) => void;
};

export function MaioresDespesasCard({ rows, bancoName, onSelect }: MaioresDespesasCardProps) {
  const { formatValor } = useFinanceiroPrivacy();

  return (
    <FinanceiroCartao title="Maiores despesas" subtitle="Clique para ver o lançamento">
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Sem despesas no período.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.descricao || "Sem descrição"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(row.data)} · {bancoName(row.banco_id)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatValor(row.cents / 100)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </FinanceiroCartao>
  );
}
