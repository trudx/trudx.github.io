import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { suggestCategoriaId } from "../lib/financeiro/categorize.ts";
import { parseSantanderPages, type PdfTextItem } from "../lib/pdf-statement.ts";

function item(str: string, x: number, y: number, width = 40): PdfTextItem {
  return { str, x, y, width };
}

// Layout sintético que imita o extrato consolidado: colunas DATA / DESCRIÇÃO / MOVIMENTO / SALDO.
const page: PdfTextItem[] = [
  item("Setembro/2026", 50, 780, 80),
  item("DATA", 50, 700),
  item("DESCRIÇÃO", 120, 700),
  item("MOVIMENTO", 300, 700),
  item("SALDO", 400, 700),
  item("SALDO EM 31/08", 120, 680),
  item("1.000,00", 400, 680),
  item("05/09", 50, 660),
  item("DEBITO VISA SUPERMERCADO XYZ", 120, 660, 150),
  item("150,00-", 300, 660),
  item("850,00", 400, 660),
  item("SALDO EM 30/09", 120, 640),
  item("850,00", 400, 640),
];

describe("parseSantanderPages", () => {
  it("lê lançamento, período do mês de referência e saldo final", () => {
    const result = parseSantanderPages([page]);
    assert.equal(result.transactions.length, 1);
    assert.equal(result.transactions[0].valor, 150);
    assert.equal(result.transactions[0].tipoSugerido, "gasto");
    assert.deepEqual(result.periodo, { inicio: "2026-09-01", fim: "2026-09-30" });
    assert.deepEqual(result.saldoFinal, { data: "2026-09-30", valor: 850 });
  });

  it("reimportar o mesmo PDF gera exatamente os mesmos fitid (idempotência)", () => {
    const first = parseSantanderPages([page]).transactions.map((transaction) => transaction.fitid);
    const second = parseSantanderPages([page]).transactions.map((transaction) => transaction.fitid);
    assert.deepEqual(first, second);
  });
});

describe("suggestCategoriaId", () => {
  const categorias = [
    { id: "transporte", termos: ["uber"] },
    { id: "alimentacao", termos: ["uber eats", "ifood"] },
    { id: "mercado", termos: ["mercado"] },
  ];

  it("escolhe o termo mais específico e ignora acento/caixa", () => {
    assert.equal(suggestCategoriaId("UBER EATS *PEDIDO", categorias), "alimentacao");
    assert.equal(suggestCategoriaId("Supermercado São João", categorias), "mercado");
  });

  it("sem correspondência não chuta", () => {
    assert.equal(suggestCategoriaId("Pagamento aleatório", categorias), null);
    assert.equal(suggestCategoriaId(null, categorias), null);
  });
});

import {
  buildImportLines,
  ensureFitids,
  type GroupChoice,
} from "../lib/financeiro/import-lines.ts";

describe("ensureFitids", () => {
  const tx = (overrides = {}) => ({
    fitid: null,
    data: "2026-10-05",
    valor: 6,
    descricao: "PIX",
    ...overrides,
  });

  it("gera identificador estável: reimportar o mesmo arquivo repete os mesmos ids", () => {
    const ids = (list: ReturnType<typeof ensureFitids>) => list.map((item) => item.fitid);
    assert.deepEqual(ids(ensureFitids([tx(), tx()])), ids(ensureFitids([tx(), tx()])));
  });

  it("três PIX idênticos no mesmo dia continuam sendo três", () => {
    const ids = ensureFitids([tx(), tx(), tx()]).map((item) => item.fitid);
    assert.equal(new Set(ids).size, 3);
  });

  it("preserva o FITID que o banco informou", () => {
    assert.equal(ensureFitids([tx({ fitid: "ABC" })])[0].fitid, "ABC");
  });
});

describe("buildImportLines", () => {
  const choice = (overrides: Partial<GroupChoice> = {}): GroupChoice => ({
    include: true,
    tipo: "gasto",
    cliente_id: null,
    natureza: "normal",
    categoria_id: null,
    ...overrides,
  });

  it("converte para centavos, respeita o grupo excluído e aplica natureza/categoria", () => {
    const { lines, meta } = buildImportLines(
      [
        {
          key: "a",
          transactions: [{ fitid: "1", data: "2026-10-05", valor: 19.9, descricao: "X" }],
        },
        { key: "b", transactions: [{ fitid: "2", data: "2026-10-05", valor: 1, descricao: "Y" }] },
      ],
      { a: choice({ natureza: "estorno", categoria_id: "c1" }), b: choice({ include: false }) },
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0].cents, 1990);
    assert.deepEqual(meta.get(0), { cliente_id: null, natureza: "estorno", categoria_id: "c1" });
  });
});
