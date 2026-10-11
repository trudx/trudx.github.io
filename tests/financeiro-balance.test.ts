import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeBankBalance,
  consolidateBalances,
  type SaldoBancoRow,
} from "../lib/financeiro/balance.ts";

const base: SaldoBancoRow = {
  banco_id: "santander",
  ref_data: "2026-09-30",
  ref_saldo_cents: 100000,
  mov_oficial_cents: -20000,
  mov_total_cents: -62000,
  total_cents: 999999,
  provisorios_qtd: 8,
  provisorios_cents: -42000,
  provisorios_obsoletos_qtd: 0,
  ultima_cobertura: "2026-09-30",
};

describe("computeBankBalance", () => {
  it("com referência: confirmado = ref + oficiais; estimado = ref + tudo", () => {
    const balance = computeBankBalance(base);
    assert.equal(balance.kind, "bancario");
    assert.equal(balance.confirmado, 80000);
    assert.equal(balance.estimado, 38000);
    assert.equal(balance.naoConfirmado, -42000);
  });

  it("sem referência: valor é só calculado e não há saldo confirmado", () => {
    const balance = computeBankBalance({ ...base, ref_data: null, ref_saldo_cents: null });
    assert.equal(balance.kind, "calculado");
    assert.equal(balance.confirmado, null);
    assert.equal(balance.estimado, 999999);
  });
});

describe("consolidateBalances", () => {
  it("soma os bancos e sinaliza o consolidado parcial quando falta referência", () => {
    const santander = computeBankBalance(base);
    const nubank = computeBankBalance({
      ...base,
      banco_id: "nubank",
      ref_data: null,
      ref_saldo_cents: null,
      total_cents: 5000,
    });
    const consolidated = consolidateBalances([santander, nubank]);

    assert.equal(consolidated.estimado, 38000 + 5000);
    assert.equal(consolidated.confirmado, 80000);
    assert.equal(consolidated.isCompleto, false);
    assert.deepEqual(consolidated.bancosSemReferencia, ["nubank"]);
  });

  it("sem nenhuma referência não existe saldo confirmado consolidado", () => {
    const only = computeBankBalance({ ...base, ref_data: null, ref_saldo_cents: null });
    assert.equal(consolidateBalances([only]).confirmado, null);
  });
});
