import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
  pickGranularity,
  topExpenses,
} from "../lib/financeiro/analytics.ts";
import { toCents, variation } from "../lib/financeiro/money.ts";
import { suggestNatureza } from "../lib/financeiro/natureza.ts";
import type { LedgerRow } from "../lib/financeiro/types.ts";

let counter = 0;
function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  counter++;
  return {
    id: `r${counter}`,
    data: "2026-10-05",
    tipo: "gasto",
    cents: 10000,
    status: "confirmado",
    natureza: "normal",
    banco_id: "nubank",
    categoria_id: null,
    cliente_id: null,
    fitid: null,
    descricao: null,
    gasto_fixo_id: null,
    ...overrides,
  };
}

describe("dinheiro", () => {
  it("converte para centavos sem erro de ponto flutuante", () => {
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(19.99), 1999);
    const total = [0.1, 0.2, 0.3].map(toCents).reduce((a, b) => a + b, 0);
    assert.equal(total, 60);
  });

  it("variação trata divisão por zero e período sem movimento", () => {
    assert.deepEqual(variation(0, 0), { abs: 0, pct: 0 });
    assert.deepEqual(variation(500, 0), { abs: 500, pct: null });
    assert.equal(variation(150, 100).pct, 50);
    assert.equal(variation(50, 100).pct, -50);
  });
});

describe("computeTotals", () => {
  it("separa receitas e despesas", () => {
    const totals = computeTotals([
      row({ tipo: "ganho", cents: 500000 }),
      row({ cents: 20000 }),
      row({ tipo: "gasto_fixo", cents: 30000 }),
    ]);
    assert.equal(totals.receitas, 500000);
    assert.equal(totals.despesas, 50000);
    assert.equal(totals.resultado, 450000);
  });

  it("transferência entre contas próprias não infla receitas nem despesas", () => {
    const totals = computeTotals([
      row({ banco_id: "santander", cents: 100000, natureza: "transferencia" }),
      row({ banco_id: "nubank", tipo: "ganho", cents: 100000, natureza: "transferencia" }),
    ]);
    assert.equal(totals.receitas, 0);
    assert.equal(totals.despesas, 0);
    assert.equal(totals.internosQtd, 2);
  });

  it("estorno abate a despesa em vez de virar receita", () => {
    const totals = computeTotals([
      row({ cents: 20000 }),
      row({ tipo: "ganho", cents: 5000, natureza: "estorno" }),
    ]);
    assert.equal(totals.receitas, 0);
    assert.equal(totals.despesas, 15000);
  });

  it("provisório conciliado é uma linha só e não conta em dobro", () => {
    const totals = computeTotals([row({ cents: 15000, status: "conciliado", fitid: "pdf-1" })]);
    assert.equal(totals.despesas, 15000);
  });
});

describe("comparisonBase", () => {
  it("mês fechado compara com o mês anterior inteiro", () => {
    const base = comparisonBase({ start: "2026-09-01", end: "2026-09-30" }, "2026-10-11", true);
    assert.deepEqual(base.previous, { start: "2026-08-01", end: "2026-08-31" });
  });

  it("mês em andamento compara os mesmos primeiros dias", () => {
    const base = comparisonBase({ start: "2026-10-01", end: "2026-10-31" }, "2026-10-11", true);
    assert.deepEqual(base.current, { start: "2026-10-01", end: "2026-10-11" });
    assert.deepEqual(base.previous, { start: "2026-09-01", end: "2026-09-11" });
    assert.match(base.label, /11 primeiros dias/);
  });

  it("mês anterior mais curto não ultrapassa o próprio mês", () => {
    const base = comparisonBase({ start: "2026-03-01", end: "2026-03-31" }, "2026-03-30", true);
    assert.equal(base.previous.end, "2026-02-28");
  });

  it("intervalo livre usa janela de mesmo tamanho imediatamente antes", () => {
    const base = comparisonBase({ start: "2026-10-01", end: "2026-10-10" }, "2026-12-01", false);
    assert.deepEqual(base.previous, { start: "2026-09-21", end: "2026-09-30" });
  });
});

describe("série temporal", () => {
  it("escolhe a granularidade pelo tamanho do intervalo", () => {
    assert.equal(pickGranularity({ start: "2026-10-01", end: "2026-10-31" }), "dia");
    assert.equal(pickGranularity({ start: "2026-07-01", end: "2026-10-31" }), "semana");
    assert.equal(pickGranularity({ start: "2025-01-01", end: "2026-10-31" }), "mes");
  });

  it("preenche dias vazios e soma por dia", () => {
    const series = buildSeries(
      [
        row({ data: "2026-10-02", cents: 100 }),
        row({ data: "2026-10-02", cents: 50 }),
        row({ data: "2026-10-04", tipo: "ganho", cents: 700 }),
      ],
      { start: "2026-10-01", end: "2026-10-04" },
      "dia",
    );
    assert.equal(series.length, 4);
    assert.equal(series[1].despesas, 150);
    assert.equal(series[2].despesas, 0);
    assert.equal(series[3].receitas, 700);
  });

  it("agrupa por semana começando na segunda", () => {
    const series = buildSeries(
      [row({ data: "2026-10-07" })],
      { start: "2026-10-05", end: "2026-10-18" },
      "semana",
    );
    assert.deepEqual(
      series.map((point) => point.key),
      ["2026-10-05", "2026-10-12"],
    );
    assert.equal(series[0].despesas, 10000);
  });

  it("a soma da série é igual ao total dos cards", () => {
    const rows = [
      row({ data: "2026-10-02" }),
      row({ data: "2026-10-09", tipo: "ganho", cents: 3300 }),
      row({ data: "2026-10-09", natureza: "transferencia" }),
    ];
    const range = { start: "2026-10-01", end: "2026-10-31" };
    const series = buildSeries(rows, range, "semana");
    const totals = computeTotals(rows);
    assert.equal(
      series.reduce((sum, point) => sum + point.despesas, 0),
      totals.despesas,
    );
    assert.equal(
      series.reduce((sum, point) => sum + point.receitas, 0),
      totals.receitas,
    );
  });
});

describe("categorias", () => {
  it("calcula participação percentual que fecha em 100%", () => {
    const shares = expenseByCategory([
      row({ categoria_id: "a", cents: 7500 }),
      row({ categoria_id: "b", cents: 2500 }),
      row({ categoria_id: null, cents: 0 }),
    ]);
    assert.equal(shares[0].pct, 75);
    assert.equal(
      shares.reduce((sum, item) => sum + item.pct, 0),
      100,
    );
  });

  it("ignora transferências internas", () => {
    assert.equal(expenseByCategory([row({ natureza: "transferencia" })]).length, 0);
  });

  it("detecta categorias que subiram e desceram", () => {
    const changes = categoryChanges(
      [row({ categoria_id: "a", cents: 3000 }), row({ categoria_id: "b", cents: 1000 })],
      [row({ categoria_id: "a", cents: 1000 }), row({ categoria_id: "b", cents: 4000 })],
    );
    assert.equal(changes.find((change) => change.categoriaId === "a")?.abs, 2000);
    assert.equal(changes.find((change) => change.categoriaId === "b")?.abs, -3000);
    assert.equal(changes[0].categoriaId, "b");
  });
});

describe("fixo × variável", () => {
  it("separa fixo realizado, fixo previsto (provisório) e variável", () => {
    const result = fixedVersusVariable([
      row({ tipo: "gasto_fixo", cents: 30000, status: "conciliado", fitid: "x" }),
      row({ tipo: "gasto_fixo", cents: 9900, status: "provisorio" }),
      row({ tipo: "gasto", cents: 70000 }),
    ]);
    assert.equal(result.fixoRealizado, 30000);
    assert.equal(result.fixoPrevisto, 9900);
    assert.equal(result.variavel, 70000);
    assert.equal(result.fixoPct, 30);
    assert.equal(result.variavelPct, 70);
  });
});

describe("banco e ranking", () => {
  it("distribui por banco respeitando a natureza", () => {
    const flows = flowByBank([
      row({ banco_id: "a", cents: 1000 }),
      row({ banco_id: "b", tipo: "ganho", cents: 5000 }),
      row({ banco_id: "a", cents: 99999, natureza: "transferencia" }),
    ]);
    assert.equal(flows.find((flow) => flow.bancoId === "a")?.despesas, 1000);
    assert.equal(flows.find((flow) => flow.bancoId === "b")?.receitas, 5000);
  });

  it("ranking ignora ganhos e movimentos internos", () => {
    const top = topExpenses(
      [
        row({ cents: 100 }),
        row({ cents: 900 }),
        row({ cents: 5000, natureza: "transferencia" }),
        row({ tipo: "ganho", cents: 8000 }),
      ],
      2,
    );
    assert.deepEqual(
      top.map((item) => item.cents),
      [900, 100],
    );
  });
});

describe("saldo acumulado", () => {
  it("parte do saldo inicial e acumula; confirmado só com movimento oficial", () => {
    const points = buildBalanceSeries(
      [
        row({ data: "2026-10-02", cents: 1000, fitid: "f1" }),
        row({ data: "2026-10-03", cents: 400, status: "provisorio" }),
        row({ data: "2026-10-03", tipo: "ganho", cents: 2500, fitid: "f2" }),
      ],
      { start: "2026-10-01", end: "2026-10-03" },
      { estimado: 10000, confirmado: 9000 },
    );
    assert.deepEqual(
      points.map((point) => point.estimado),
      [10000, 9000, 11100],
    );
    assert.deepEqual(
      points.map((point) => point.confirmado),
      [9000, 8000, 10500],
    );
  });

  it("sem base bancária não inventa série confirmada", () => {
    const points = buildBalanceSeries(
      [row()],
      { start: "2026-10-05", end: "2026-10-05" },
      { estimado: 0, confirmado: null },
    );
    assert.equal(points[0].confirmado, null);
  });

  it("transferência interna move saldo entre bancos mas não some do saldo do banco", () => {
    const points = buildBalanceSeries(
      [row({ natureza: "transferencia", cents: 100000 })],
      { start: "2026-10-05", end: "2026-10-05" },
      { estimado: 200000, confirmado: null },
    );
    assert.equal(points[0].estimado, 100000);
  });
});

describe("insights", () => {
  const input = {
    categoryName: (id: string | null) => id ?? "Sem categoria",
    provisoriosQtd: 0,
    obsoletosQtd: 0,
    formatCents: (cents: number) => `R$ ${cents / 100}`,
    comparisonLabel: "Comparado com o mês anterior",
    isBalanceComplete: true,
  };

  it("não afirma tendência com poucos dados", () => {
    const insights = buildInsights({
      ...input,
      current: [row({ cents: 90000 })],
      previous: [row({ cents: 10000 })],
    });
    assert.equal(
      insights.some((insight) => insight.id === "despesas-variacao"),
      false,
    );
  });

  it("aponta aumento de despesas com dados suficientes", () => {
    const current = Array.from({ length: 6 }, () => row({ cents: 11400 }));
    const previous = Array.from({ length: 6 }, () => row({ cents: 10000 }));
    const insights = buildInsights({ ...input, current, previous });
    assert.match(
      insights.find((insight) => insight.id === "despesas-variacao")?.text ?? "",
      /aumentaram 14%/,
    );
  });

  it("avisa sobre provisórios e saldo incompleto", () => {
    const insights = buildInsights({
      ...input,
      current: [],
      previous: [],
      provisoriosQtd: 5,
      isBalanceComplete: false,
    });
    assert.ok(
      insights.some(
        (insight) => insight.id === "provisorios" && /5 lançamentos provisórios/.test(insight.text),
      ),
    );
    assert.ok(insights.some((insight) => insight.id === "saldo-incompleto"));
  });
});

describe("suggestNatureza", () => {
  it("reconhece estorno e pagamento de fatura, e deixa o resto como normal", () => {
    assert.equal(suggestNatureza("ESTORNO COMPRA XYZ"), "estorno");
    assert.equal(suggestNatureza("Pagamento de fatura Nubank"), "pagamento_fatura");
    assert.equal(suggestNatureza("DEBITO VISA SUPERMERCADO"), "normal");
  });
});
