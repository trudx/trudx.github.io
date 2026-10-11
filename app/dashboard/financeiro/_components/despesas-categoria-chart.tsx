"use client";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { CategoryShare } from "@/lib/financeiro/analytics";

//* Utils Imports
import { cn } from "@/lib/utils";

type DespesasCategoriaChartProps = {
  categories: CategoryShare[];
  categoryName: (id: string | null) => string;
  /** Ids atualmente filtrados (`__none` = sem categoria). */
  selected: string[];
  onSelect: (id: string | null) => void;
};

const NONE = "__none";

/** Barras horizontais em HTML: clicáveis, acessíveis e sem custo de biblioteca. Clicar filtra a tabela. */
export function DespesasCategoriaChart({
  categories,
  categoryName,
  selected,
  onSelect,
}: DespesasCategoriaChartProps) {
  const { formatValor } = useFinanceiroPrivacy();
  const max = Math.max(...categories.map((category) => category.cents), 1);

  if (categories.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas no período.</p>
    );
  }

  return (
    <ul className="space-y-1">
      {categories.map((category) => {
        const key = category.categoriaId ?? NONE;
        const isSelected = selected.includes(key);
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(category.categoriaId)}
              className={cn(
                "w-full rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50",
                isSelected && "bg-accent",
              )}
            >
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{categoryName(category.categoriaId)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatValor(category.cents / 100)} ·{" "}
                  {category.pct.toFixed(category.pct < 10 ? 1 : 0)}%
                </span>
              </span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                  style={{ width: `${Math.max((category.cents / max) * 100, 2)}%` }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
