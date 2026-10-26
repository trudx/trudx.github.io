import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCsvStatement } from "../lib/csv-statement.ts";

function csv(text: string) {
  return new File([text], "extrato.csv");
}

describe("extrato em CSV", () => {
  it("lê valor com sinal, vírgula decimal, aspas e BOM", async () => {
    const result = await parseCsvStatement(
      csv('﻿Data;Descrição;Valor\r\n25/10/2026;"Mercado; X";-1.234,56\r\n26/10/2026;Pix;300,00\r\nxx;lixo;1'),
    );
    assert.deepEqual(
      result.transactions.map((t) => [t.data, t.valor, t.tipoSugerido, t.descricao]),
      [
        ["2026-10-25", 1234.56, "gasto", "Mercado; X"],
        ["2026-10-26", 300, "ganho", "Pix"],
      ],
    );
    assert.equal(result.warnings.length, 1);
    assert.deepEqual(result.periodo, { inicio: "2026-10-25", fim: "2026-10-26" });
  });

  it("lê colunas separadas de crédito e débito, com separador vírgula e ISO", async () => {
    const result = await parseCsvStatement(
      csv("date,description,credit,debit\n2026-10-01,Salário,1000.00,\n2026-10-02,Luz,,89.90"),
    );
    assert.deepEqual(
      result.transactions.map((t) => [t.valor, t.tipoSugerido]),
      [
        [1000, "ganho"],
        [89.9, "gasto"],
      ],
    );
  });

  it("acha o cabeçalho abaixo de linhas de informação do banco", async () => {
    const result = await parseCsvStatement(
      csv("Conta: 123\n\nData;Histórico;Valor\n01/10/2026;Tarifa;-9,90"),
    );
    assert.equal(result.transactions.length, 1);
  });

  it("falha sem as colunas necessárias", async () => {
    await assert.rejects(parseCsvStatement(csv("a;b\n1;2")));
  });
});
