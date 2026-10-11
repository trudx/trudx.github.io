"use client";

//* Components Imports
import { FinanceiroCartao } from "./financeiro-cartao";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { BankBalance } from "@/lib/financeiro/balance";
import type { BankFlow } from "@/lib/financeiro/analytics";

//* Utils Imports
import { SEM_VALOR } from "@/lib/financeiro/dashboard";
import { cn } from "@/lib/utils";

type DistribuicaoBancosCardProps = {
  flows: BankFlow[];
  balances: BankBalance[];
  bancoName: (id: string | null) => string;
  selected: string[];
  onSelect: (id: string | null) => void;
};

export function DistribuicaoBancosCard({
  flows,
  balances,
  bancoName,
  selected,
  onSelect,
}: DistribuicaoBancosCardProps) {
  const { formatValor } = useFinanceiroPrivacy();
  const ids = [
    ...new Set([
      ...flows.map((flow) => flow.bancoId),
      ...balances.map((balance) => balance.bancoId),
    ]),
  ];
  const rows = ids.map((id) => ({
    id,
    flow: flows.find((flow) => flow.bancoId === id),
    balance: balances.find((balance) => balance.bancoId === id),
  }));

  return (
    <FinanceiroCartao
      title="Distribuição por banco"
      subtitle="Clique para filtrar por banco; clique de novo para ver todos"
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhum banco com movimento.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ id, flow, balance }) => {
            const isSelected = selected.includes(id ?? SEM_VALOR);
            return (
              <li key={id ?? "none"}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(id)}
                  className={cn(
                    "w-full rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50",
                    isSelected && "bg-accent",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{bancoName(id)}</span>
                    {balance && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatValor(balance.estimado / 100)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {balance.kind === "bancario" ? "estimado" : "calculado"}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex gap-4 text-xs text-muted-foreground">
                    <span>Receitas {formatValor((flow?.receitas ?? 0) / 100)}</span>
                    <span>Despesas {formatValor((flow?.despesas ?? 0) / 100)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </FinanceiroCartao>
  );
}
