import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { duplicateSearchRange, findAiDuplicates, parseDuplicateAnswer } from "../lib/financeiro/ai-duplicates.ts";
import { DEFAULT_AI_SETTINGS } from "../lib/ai/models.ts";

const existing = [
  { id: "a", data: "2026-10-10", tipo: "gasto" as const, valor: 50, descricao: "Mercado Souza" },
  { id: "b", data: "2026-10-11", tipo: "gasto" as const, valor: 50, descricao: "Padaria" },
];

describe("duplicatas apontadas pela IA", () => {
  it("lê JSON dentro de cercas e descarta referências inválidas ou repetidas", () => {
    const text =
      '```json\n{"duplicatas":[{"novo":0,"existente":"e0","motivo":"mesmo mercado"},{"novo":1,"existente":"e0"},{"novo":9,"existente":"e1"},{"novo":1,"existente":"e7"}]}\n```';
    const result = parseDuplicateAnswer(text, 2, existing);
    assert.equal(result.length, 1);
    assert.equal(result[0].index, 0);
    assert.equal(result[0].existing.id, "a");
  });

  it("rejeita resposta sem JSON", () => {
    assert.throws(() => parseDuplicateAnswer("não sei", 1, existing));
  });

  it("amplia o intervalo de busca em torno das datas novas", () => {
    const range = duplicateSearchRange([
      { data: "2026-10-10", tipo: "gasto", valor: 1, descricao: "x" },
      { data: "2026-10-12", tipo: "gasto", valor: 1, descricao: "y" },
    ]);
    assert.deepEqual(range, { min: "2026-10-06", max: "2026-10-16" });
  });

  it("só consulta a IA quando há lançamento existente em datas próximas", async () => {
    let calls = 0;
    const request = async () => {
      calls++;
      return {
        role: "assistant" as const,
        content: '{"duplicatas":[{"novo":0,"existente":"e0","motivo":"igual"}]}',
      };
    };
    const signal = new AbortController().signal;
    const news = [{ data: "2026-10-11", tipo: "gasto" as const, valor: 50, descricao: "MERCADO SOUZA" }];

    const found = await findAiDuplicates(DEFAULT_AI_SETTINGS, news, existing, signal, request);
    assert.equal(found.length, 1);
    assert.equal(calls, 1);

    const other = [{ ...news[0], data: "2026-12-01" }];
    assert.equal((await findAiDuplicates(DEFAULT_AI_SETTINGS, other, existing, signal, request)).length, 0);
    assert.equal(calls, 1);
  });
});
