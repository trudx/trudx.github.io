import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDashboard,
  EMPTY_FILTERS,
  matchesFilters,
  SEM_VALOR,
} from "../lib/financeiro/dashboard.ts";
import type { SaldoBancoRow } from "../lib/financeiro/balance.ts";
import type { LedgerRow } from "../lib/financeiro/types.ts";

let n = 0;
function row(o: Partial<LedgerRow> = {}): LedgerRow {
  n++;
  return {
    id: `r${n}`,
    data: "2026-09-10",
    tipo: "gasto",
    cents: 10000,
    status: "confirmado",
    natureza: "normal",
    banco_id: "nu",
    categoria_id: null,
    cliente_id: null,
    fitid: null,
    descricao: null,
    gasto_fixo_id: null,
    ...o,
  };
}
const saldo = (o: Partial<SaldoBancoRow> = {}): SaldoBancoRow => ({
  banco_id: "nu",
  ref_data: "2026-08-31",
  ref_saldo_cents: 100000,
  mov_oficial_cents: 0,
  mov_total_cents: 0,
  total_cents: 0,
  provisorios_qtd: 0,
  provisorios_cents: 0,
  provisorios_obsoletos_qtd: 0,
  ultima_cobertura: null,
  ...o,
});

const base = {
  period: { start: "2026-09-01", end: "2026-09-30" },
  isMonth: true,
  today: "2026-10-11",
  filters: EMPTY_FILTERS,
  saldosHoje: [saldo()],
  saldosInicio: [saldo()],
  categoryName: (id: string | null) => id ?? "Sem categoria",
  formatCents: (c: number) => `R$ ${c / 100}`,
};

describe("matchesFilters", () => {
  it("aplica banco, sem-banco e categoria", () => {
    assert.equal(
      matchesFilters(row({ banco_id: null }), { ...EMPTY_FILTERS, banco: [SEM_VALOR] }),
      true,
    );
    assert.equal(
      matchesFilters(row({ banco_id: "x" }), { ...EMPTY_FILTERS, banco: ["nu"] }),
      false,
    );
    assert.equal(
      matchesFilters(row({ fitid: "pdf-1" }), { ...EMPTY_FILTERS, origem: ["pdf"] }),
      true,
    );
  });
  it("pode ignorar um filtro", () => {
    assert.equal(
      matchesFilters(row({ banco_id: "x" }), { ...EMPTY_FILTERS, banco: ["nu"] }, ["banco"]),
      true,
    );
  });
});

describe("buildDashboard", () => {
  it("cards, série e categorias usam os mesmos números", () => {
    const rows = [
      row({ cents: 30000, categoria_id: "a" }),
      row({ tipo: "ganho", cents: 90000 }),
      row({ cents: 50000, natureza: "transferencia" }),
    ];
    const m = buildDashboard({ ...base, currentRows: rows, previousRows: [] });
    assert.equal(m.totals.despesas, 30000);
    assert.equal(
      m.series.reduce((s, p) => s + p.despesas, 0),
      m.totals.despesas,
    );
    assert.equal(
      m.categories.reduce((s, c) => s + c.cents, 0),
      m.totals.despesas,
    );
    assert.equal(m.totals.internosQtd, 1);
  });

  it("filtros não temporais valem para os dois períodos comparados", () => {
    const m = buildDashboard({
      ...base,
      filters: { ...EMPTY_FILTERS, banco: ["nu"] },
      currentRows: [row({ cents: 20000 }), row({ cents: 99999, banco_id: "san" })],
      previousRows: [
        row({ data: "2026-08-10", cents: 10000 }),
        row({ data: "2026-08-10", cents: 77777, banco_id: "san" }),
      ],
    });
    assert.equal(m.totals.despesas, 20000);
    assert.equal(m.previousTotals.despesas, 10000);
    assert.equal(m.despesasVar.pct, 100);
  });

  it("período anterior sem movimento não gera divisão por zero", () => {
    const m = buildDashboard({ ...base, currentRows: [row()], previousRows: [] });
    assert.equal(m.despesasVar.pct, null);
  });

  it("saldo estimado separa confirmado e não duplica conciliado", () => {
    const m = buildDashboard({
      ...base,
      currentRows: [],
      previousRows: [],
      saldosHoje: [
        saldo({
          mov_oficial_cents: -10000,
          mov_total_cents: -14200,
          provisorios_qtd: 2,
          provisorios_cents: -4200,
        }),
      ],
    });
    assert.equal(m.balance.confirmado, 90000);
    assert.equal(m.balance.estimado, 85800);
    assert.equal(m.balance.naoConfirmado, -4200);
    assert.equal(m.balanceSeriesKind, "bancario");
  });

  it("sem saldo de referência a série é só calculada", () => {
    const m = buildDashboard({
      ...base,
      currentRows: [row()],
      previousRows: [],
      saldosInicio: [saldo({ ref_data: null, ref_saldo_cents: null, total_cents: 5000 })],
    });
    assert.equal(m.balanceSeriesKind, "calculado");
    assert.equal(m.balanceSeries[0].confirmado, null);
  });

  it("o gráfico de saldo ignora filtros que não são de banco", () => {
    const m = buildDashboard({
      ...base,
      filters: { ...EMPTY_FILTERS, tipo: "ganho" },
      currentRows: [row({ data: "2026-09-02", cents: 1000 })],
      previousRows: [],
    });
    assert.equal(m.balanceSeries.at(-1)?.estimado, 100000 - 1000 + 0);
  });
});
