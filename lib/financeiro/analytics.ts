import type { FinanceiroNatureza, LedgerRow } from "./types.ts";
import { variation, type Variation } from "./money.ts";

/**
 * Toda a análise do dashboard sai daqui — cards, gráficos, comparativos e insights leem as mesmas
 * funções, para os números nunca divergirem entre componentes. Valores em centavos.
 */

export type DateRange = { start: string; end: string };

const INTERNAL: FinanceiroNatureza[] = ["transferencia", "pagamento_fatura"];

export function isInternal(row: LedgerRow) {
  return INTERNAL.includes(row.natureza);
}

/** Impacto do lançamento em receitas/despesas (centavos). Internos não impactam; estorno abate despesa. */
function effect(row: LedgerRow): { receita: number; despesa: number } {
  if (isInternal(row)) return { receita: 0, despesa: 0 };
  const isIncome = row.tipo === "ganho";
  if (row.natureza === "estorno") {
    return isIncome ? { receita: 0, despesa: -row.cents } : { receita: -row.cents, despesa: 0 };
  }
  return isIncome ? { receita: row.cents, despesa: 0 } : { receita: 0, despesa: row.cents };
}

export type Totals = {
  receitas: number;
  despesas: number;
  resultado: number;
  /** Movimentações internas deixadas de fora (valor absoluto somado) e quantas foram. */
  internosCents: number;
  internosQtd: number;
};

export function computeTotals(rows: LedgerRow[]): Totals {
  let receitas = 0;
  let despesas = 0;
  let internosCents = 0;
  let internosQtd = 0;

  for (const row of rows) {
    if (isInternal(row)) {
      internosCents += row.cents;
      internosQtd++;
      continue;
    }
    const { receita, despesa } = effect(row);
    receitas += receita;
    despesas += despesa;
  }

  return { receitas, despesas, resultado: receitas - despesas, internosCents, internosQtd };
}

/** Movimento com sinal para saldo bancário: o dinheiro entra ou sai independentemente da natureza. */
export function signedCents(row: LedgerRow) {
  return row.tipo === "ganho" ? row.cents : -row.cents;
}

// ---------- datas ----------

function parse(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function format(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const next = parse(date);
  next.setUTCDate(next.getUTCDate() + days);
  return format(next);
}

export function diffDays(a: string, b: string) {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return format(
    new Date(Date.UTC(nextYear, nextMonth - 1, Math.min(day, daysInMonth(nextYear, nextMonth)))),
  );
}

export type ComparisonBase = {
  current: DateRange;
  previous: DateRange;
  /** Texto curto explicando a base usada, mostrado na interface. */
  label: string;
};

/**
 * Período anterior equivalente.
 * - Mês fechado → mês anterior inteiro.
 * - Mês em andamento → mesmos N primeiros dias do mês anterior (comparar mês parcial com mês cheio
 *   faria toda despesa parecer menor).
 * - Intervalo livre → janela de mesmo tamanho imediatamente antes.
 */
export function comparisonBase(period: DateRange, today: string, isMonth: boolean): ComparisonBase {
  if (isMonth) {
    const monthStart = period.start;
    const inProgress = today >= period.start && today <= period.end;
    const prevStart = addMonths(monthStart, -1);
    if (inProgress) {
      const elapsed = diffDays(today, monthStart);
      const prevEnd = addDays(prevStart, elapsed);
      const prevMonthEnd = addDays(monthStart, -1);
      return {
        current: { start: period.start, end: today },
        previous: { start: prevStart, end: prevEnd < prevMonthEnd ? prevEnd : prevMonthEnd },
        label: `Mês em andamento: ${elapsed + 1} primeiros dias comparados com o mesmo trecho do mês anterior`,
      };
    }
    return {
      current: period,
      previous: { start: prevStart, end: addDays(monthStart, -1) },
      label: "Comparado com o mês anterior",
    };
  }

  const length = diffDays(period.end, period.start) + 1;
  return {
    current: period,
    previous: { start: addDays(period.start, -length), end: addDays(period.start, -1) },
    label: `Comparado com os ${length} dias anteriores`,
  };
}

export function inRange(row: LedgerRow, range: DateRange) {
  return row.data >= range.start && row.data <= range.end;
}

// ---------- série temporal ----------

export type Granularity = "dia" | "semana" | "mes";

export function pickGranularity(range: DateRange): Granularity {
  const days = diffDays(range.end, range.start) + 1;
  if (days <= 62) return "dia";
  if (days <= 210) return "semana";
  return "mes";
}

function bucketStart(date: string, granularity: Granularity) {
  if (granularity === "dia") return date;
  if (granularity === "mes") return `${date.slice(0, 7)}-01`;
  const weekday = (parse(date).getUTCDay() + 6) % 7; // segunda = 0
  return addDays(date, -weekday);
}

function nextBucket(start: string, granularity: Granularity) {
  if (granularity === "dia") return addDays(start, 1);
  if (granularity === "semana") return addDays(start, 7);
  return addMonths(start, 1);
}

export type SeriesPoint = { key: string; receitas: number; despesas: number };

/** Receitas × despesas por balde, com baldes vazios preenchidos com zero (o eixo do tempo fica contínuo). */
export function buildSeries(
  rows: LedgerRow[],
  range: DateRange,
  granularity: Granularity,
): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();
  let cursor = bucketStart(range.start, granularity);
  while (cursor <= range.end) {
    points.set(cursor, { key: cursor, receitas: 0, despesas: 0 });
    cursor = nextBucket(cursor, granularity);
  }

  for (const row of rows) {
    if (!inRange(row, range)) continue;
    const point = points.get(bucketStart(row.data, granularity));
    if (!point) continue;
    const { receita, despesa } = effect(row);
    point.receitas += receita;
    point.despesas += despesa;
  }

  return [...points.values()];
}

// ---------- categorias ----------

export type CategoryShare = { categoriaId: string | null; cents: number; pct: number; qtd: number };

export function expenseByCategory(rows: LedgerRow[]): CategoryShare[] {
  const groups = new Map<string | null, { cents: number; qtd: number }>();

  for (const row of rows) {
    const { despesa } = effect(row);
    if (despesa === 0) continue;
    const group = groups.get(row.categoria_id) ?? { cents: 0, qtd: 0 };
    group.cents += despesa;
    group.qtd++;
    groups.set(row.categoria_id, group);
  }

  const positive = [...groups.entries()].filter(([, group]) => group.cents > 0);
  const total = positive.reduce((sum, [, group]) => sum + group.cents, 0);

  return positive
    .map(([categoriaId, group]) => ({
      categoriaId,
      cents: group.cents,
      qtd: group.qtd,
      pct: total === 0 ? 0 : (group.cents / total) * 100,
    }))
    .sort((a, b) => b.cents - a.cents);
}

export type CategoryChange = {
  categoriaId: string | null;
  atual: number;
  anterior: number;
} & Variation;

export function categoryChanges(current: LedgerRow[], previous: LedgerRow[]): CategoryChange[] {
  const now = new Map(expenseByCategory(current).map((item) => [item.categoriaId, item.cents]));
  const before = new Map(expenseByCategory(previous).map((item) => [item.categoriaId, item.cents]));
  const ids = new Set([...now.keys(), ...before.keys()]);

  return [...ids]
    .map((categoriaId) => {
      const atual = now.get(categoriaId) ?? 0;
      const anterior = before.get(categoriaId) ?? 0;
      return { categoriaId, atual, anterior, ...variation(atual, anterior) };
    })
    .sort((a, b) => Math.abs(b.abs) - Math.abs(a.abs));
}

// ---------- fixo × variável ----------

export type FixedVariable = {
  fixoRealizado: number;
  /** Fixo gerado pelo sistema que ainda aguarda o débito no extrato — não entra no percentual. */
  fixoPrevisto: number;
  variavel: number;
  fixoPct: number;
  variavelPct: number;
};

export function fixedVersusVariable(rows: LedgerRow[]): FixedVariable {
  let fixoRealizado = 0;
  let fixoPrevisto = 0;
  let variavel = 0;

  for (const row of rows) {
    const { despesa } = effect(row);
    if (despesa === 0) continue;
    if (row.tipo === "gasto_fixo") {
      if (row.status === "provisorio") fixoPrevisto += despesa;
      else fixoRealizado += despesa;
    } else {
      variavel += despesa;
    }
  }

  const base = fixoRealizado + variavel;
  return {
    fixoRealizado,
    fixoPrevisto,
    variavel,
    fixoPct: base > 0 ? (fixoRealizado / base) * 100 : 0,
    variavelPct: base > 0 ? (variavel / base) * 100 : 0,
  };
}

// ---------- por banco ----------

export type BankFlow = { bancoId: string | null; receitas: number; despesas: number; qtd: number };

export function flowByBank(rows: LedgerRow[]): BankFlow[] {
  const groups = new Map<string | null, BankFlow>();
  for (const row of rows) {
    const group = groups.get(row.banco_id) ?? {
      bancoId: row.banco_id,
      receitas: 0,
      despesas: 0,
      qtd: 0,
    };
    const { receita, despesa } = effect(row);
    group.receitas += receita;
    group.despesas += despesa;
    group.qtd++;
    groups.set(row.banco_id, group);
  }
  return [...groups.values()].sort((a, b) => b.receitas + b.despesas - (a.receitas + a.despesas));
}

// ---------- ranking ----------

export function topExpenses(rows: LedgerRow[], limit = 5): LedgerRow[] {
  return rows
    .filter((row) => row.natureza === "normal" && row.tipo !== "ganho")
    .sort((a, b) => b.cents - a.cents || (a.data < b.data ? 1 : -1))
    .slice(0, limit);
}

// ---------- saldo acumulado ----------

export type BalancePoint = { date: string; estimado: number; confirmado: number | null };

/**
 * Evolução diária do saldo a partir do saldo inicial do período.
 * `confirmado` só acumula movimentos oficiais (com fitid) e é `null` quando não há base bancária.
 * Provisórios entram apenas na série estimada.
 */
export function buildBalanceSeries(
  rows: LedgerRow[],
  range: DateRange,
  start: { estimado: number; confirmado: number | null },
): BalancePoint[] {
  const perDay = new Map<string, { total: number; oficial: number }>();
  for (const row of rows) {
    if (!inRange(row, range)) continue;
    const day = perDay.get(row.data) ?? { total: 0, oficial: 0 };
    day.total += signedCents(row);
    if (row.fitid) day.oficial += signedCents(row);
    perDay.set(row.data, day);
  }

  const points: BalancePoint[] = [];
  let estimado = start.estimado;
  let confirmado = start.confirmado;
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    const day = perDay.get(date);
    if (day) {
      estimado += day.total;
      if (confirmado !== null) confirmado += day.oficial;
    }
    points.push({ date, estimado, confirmado });
  }
  return points;
}

// ---------- insights ----------

export type Insight = { id: string; tone: "info" | "alerta" | "ok"; text: string };

export type InsightInput = {
  current: LedgerRow[];
  previous: LedgerRow[];
  categoryName: (id: string | null) => string;
  provisoriosQtd: number;
  obsoletosQtd: number;
  formatCents: (cents: number) => string;
  comparisonLabel: string;
  isBalanceComplete: boolean;
};

const MIN_ROWS = 5;

/** Regras determinísticas. Poucos dados ou cobertura incompleta → silêncio ou aviso, nunca conclusão. */
export function buildInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const now = computeTotals(input.current);
  const before = computeTotals(input.previous);
  const hasEnoughData = input.current.length >= MIN_ROWS && input.previous.length >= MIN_ROWS;

  if (input.provisoriosQtd > 0) {
    insights.push({
      id: "provisorios",
      tone: "alerta",
      text: `Existem ${input.provisoriosQtd} lançamento${input.provisoriosQtd === 1 ? "" : "s"} provisório${input.provisoriosQtd === 1 ? "" : "s"} aguardando conciliação.`,
    });
  }

  if (input.obsoletosQtd > 0) {
    insights.push({
      id: "obsoletos",
      tone: "alerta",
      text: `${input.obsoletosQtd} provisório${input.obsoletosQtd === 1 ? "" : "s"} não ${input.obsoletosQtd === 1 ? "foi encontrado" : "foram encontrados"} no extrato já importado — vale revisar.`,
    });
  }

  if (hasEnoughData && before.despesas > 0) {
    const change = variation(now.despesas, before.despesas);
    if (change.pct !== null && Math.abs(change.pct) >= 5) {
      insights.push({
        id: "despesas-variacao",
        tone: change.pct > 0 ? "alerta" : "ok",
        text: `Suas despesas ${change.pct > 0 ? "aumentaram" : "diminuíram"} ${Math.abs(Math.round(change.pct))}% em relação ao período anterior (${input.comparisonLabel.toLowerCase()}).`,
      });
    }
  }

  const categories = expenseByCategory(input.current);
  const [top] = categories;
  if (top && now.despesas > 0 && input.current.length >= MIN_ROWS && top.pct >= 15) {
    insights.push({
      id: "categoria-top",
      tone: "info",
      text: `${input.categoryName(top.categoriaId)} representa ${Math.round(top.pct)}% de suas despesas.`,
    });
  }

  const [biggest] = topExpenses(input.current, 1);
  if (biggest) {
    insights.push({
      id: "maior-despesa",
      tone: "info",
      text: `Sua maior despesa individual foi de ${input.formatCents(biggest.cents)}.`,
    });
  }

  if (!input.isBalanceComplete) {
    insights.push({
      id: "saldo-incompleto",
      tone: "alerta",
      text: "Há bancos sem saldo de referência: o saldo consolidado é calculado, não validado por extrato.",
    });
  }

  return insights;
}
