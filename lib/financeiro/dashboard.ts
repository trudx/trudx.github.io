import {
  buildBalanceSeries,
  buildInsights,
  buildSeries,
  categoryChanges,
  comparisonBase,
  computeTotals,
  expenseByCategory,
  fixedVersusVariable,
  flowByBank,
  inRange,
  pickGranularity,
  topExpenses,
  type BalancePoint,
  type CategoryChange,
  type CategoryShare,
  type ComparisonBase,
  type DateRange,
  type FixedVariable,
  type Insight,
  type SeriesPoint,
  type Totals,
  type BankFlow,
  type Granularity,
} from "./analytics.ts";
import {
  computeBankBalance,
  consolidateBalances,
  type BankBalance,
  type ConsolidatedBalance,
  type SaldoBancoRow,
} from "./balance.ts";
import { variation, type Variation } from "./money.ts";
import type { FinanceiroTipo, LedgerRow } from "./types.ts";

/** Sentinela dos filtros para "sem banco / sem cliente / sem categoria". */
export const SEM_VALOR = "__none";

export type DashboardFilters = {
  tipo: FinanceiroTipo | "all";
  origem: string[];
  cliente: string[];
  banco: string[];
  categoria: string[];
};

export const EMPTY_FILTERS: DashboardFilters = {
  tipo: "all",
  origem: [],
  cliente: [],
  banco: [],
  categoria: [],
};

function origemOf(row: LedgerRow) {
  if (!row.fitid) return "manual";
  return row.fitid.startsWith("pdf-") ? "pdf" : "ofx";
}

function passes(selected: string[], value: string | null) {
  return selected.length === 0 || selected.includes(value ?? SEM_VALOR);
}

/**
 * O mesmo predicado vale para tabela, cards, gráficos e período de comparação — é isso que mantém
 * os números consistentes. `ignore` permite desligar um filtro (ex.: a distribuição por banco
 * continua mostrando todos os bancos mesmo com um selecionado).
 */
export function matchesFilters(
  row: LedgerRow,
  filters: DashboardFilters,
  ignore: (keyof DashboardFilters)[] = [],
) {
  const skip = (key: keyof DashboardFilters) => ignore.includes(key);
  if (!skip("tipo") && filters.tipo !== "all" && row.tipo !== filters.tipo) return false;
  if (!skip("origem") && !passes(filters.origem, origemOf(row))) return false;
  if (!skip("cliente") && !passes(filters.cliente, row.cliente_id)) return false;
  if (!skip("banco") && !passes(filters.banco, row.banco_id)) return false;
  if (!skip("categoria") && !passes(filters.categoria, row.categoria_id)) return false;
  return true;
}

export type DashboardInput = {
  currentRows: LedgerRow[];
  previousRows: LedgerRow[];
  period: DateRange;
  isMonth: boolean;
  today: string;
  filters: DashboardFilters;
  saldosHoje: SaldoBancoRow[];
  saldosInicio: SaldoBancoRow[];
  categoryName: (id: string | null) => string;
  formatCents: (cents: number) => string;
};

export type DashboardModel = {
  comparison: ComparisonBase;
  totals: Totals;
  /** Totais do trecho efetivamente comparado (mês em andamento = só os primeiros N dias). */
  comparedTotals: Totals;
  previousTotals: Totals;
  receitasVar: Variation;
  despesasVar: Variation;
  resultadoVar: Variation;
  granularity: Granularity;
  series: SeriesPoint[];
  categories: CategoryShare[];
  changes: CategoryChange[];
  fixedVariable: FixedVariable;
  banks: BankFlow[];
  top: LedgerRow[];
  balance: ConsolidatedBalance;
  bankBalances: BankBalance[];
  /** Todos os bancos, ignorando o filtro de banco — alimenta a distribuição por banco. */
  allBankBalances: BankBalance[];
  balanceSeries: BalancePoint[];
  /** `bancario` só quando todos os bancos considerados têm saldo validado no início do período. */
  balanceSeriesKind: "bancario" | "calculado";
  insights: Insight[];
  isEmpty: boolean;
};

function selectBanks(saldos: SaldoBancoRow[], filters: DashboardFilters) {
  return saldos.filter((row) => passes(filters.banco, row.banco_id));
}

export function buildDashboard(input: DashboardInput): DashboardModel {
  const { filters, period } = input;
  const comparison = comparisonBase(period, input.today, input.isMonth);

  const current = input.currentRows.filter((row) => matchesFilters(row, filters));
  const previous = input.previousRows.filter((row) => matchesFilters(row, filters));
  // Mês em andamento: os dois lados cobrem o mesmo número de dias.
  const currentCompared = current.filter((row) => inRange(row, comparison.current));
  const previousCompared = previous.filter((row) => inRange(row, comparison.previous));

  const totals = computeTotals(current);
  const comparedTotals = computeTotals(currentCompared);
  const previousTotals = computeTotals(previousCompared);

  const granularity = pickGranularity(period);
  const bankRows = input.currentRows.filter((row) => matchesFilters(row, filters, ["banco"]));

  const bankBalances = selectBanks(input.saldosHoje, filters).map(computeBankBalance);
  const balance = consolidateBalances(bankBalances);

  // Saldo de partida do gráfico: posição de cada banco no dia anterior ao período.
  const startBanks = selectBanks(input.saldosInicio, filters).map(computeBankBalance);
  const startConsolidated = consolidateBalances(startBanks);
  const balanceSeriesKind = startConsolidated.isCompleto ? "bancario" : "calculado";
  const seriesEnd = period.end < input.today ? period.end : input.today;
  const balanceRows = input.currentRows.filter((row) =>
    matchesFilters(row, EMPTY_FILTERS_BANK_ONLY(filters)),
  );
  const balanceSeries =
    seriesEnd >= period.start
      ? buildBalanceSeries(
          balanceRows,
          { start: period.start, end: seriesEnd },
          {
            estimado: startConsolidated.estimado,
            confirmado: balanceSeriesKind === "bancario" ? startConsolidated.confirmado : null,
          },
        )
      : [];

  return {
    comparison,
    totals,
    comparedTotals,
    previousTotals,
    receitasVar: variation(comparedTotals.receitas, previousTotals.receitas),
    despesasVar: variation(comparedTotals.despesas, previousTotals.despesas),
    resultadoVar: variation(comparedTotals.resultado, previousTotals.resultado),
    granularity,
    series: buildSeries(current, period, granularity),
    categories: expenseByCategory(current),
    changes: categoryChanges(currentCompared, previousCompared),
    fixedVariable: fixedVersusVariable(current),
    banks: flowByBank(bankRows),
    top: topExpenses(current, 5),
    balance,
    bankBalances,
    allBankBalances: input.saldosHoje.map(computeBankBalance),
    balanceSeries,
    balanceSeriesKind,
    insights: buildInsights({
      current: currentCompared,
      previous: previousCompared,
      categoryName: input.categoryName,
      provisoriosQtd: balance.provisoriosQtd,
      obsoletosQtd: balance.obsoletosQtd,
      formatCents: input.formatCents,
      comparisonLabel: comparison.label,
      isBalanceComplete: balance.isCompleto || bankBalances.length === 0,
    }),
    isEmpty: current.length === 0,
  };
}

/** O saldo só depende do banco: tipo/categoria/cliente/origem não mudam quanto dinheiro há na conta. */
function EMPTY_FILTERS_BANK_ONLY(filters: DashboardFilters): DashboardFilters {
  return { ...EMPTY_FILTERS, banco: filters.banco };
}
