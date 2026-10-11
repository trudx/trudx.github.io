import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_MATCH_CONFIG,
  descriptionSimilarity,
  planReconciliation,
  resolvePlan,
  scorePair,
  type ImportedLine,
  type ProvisionalLine,
  type ReviewDecision,
} from "../lib/financeiro/reconciliation.ts";

function line(index: number, overrides: Partial<ImportedLine> = {}): ImportedLine {
  return {
    index,
    data: "2026-10-05",
    cents: 15000,
    tipo: "gasto",
    descricao: "DEBITO VISA SUPERMERCADO XYZ",
    fitid: `pdf-${index}`,
    ...overrides,
  };
}

function provisional(id: string, overrides: Partial<ProvisionalLine> = {}): ProvisionalLine {
  return {
    id,
    data: "2026-10-05",
    cents: 15000,
    tipo: "gasto",
    descricao: "Mercado",
    fitid: null,
    gasto_fixo_id: null,
    ...overrides,
  };
}

describe("descriptionSimilarity", () => {
  it("casa palavra do lançamento manual dentro de palavra do banco", () => {
    assert.equal(descriptionSimilarity("Mercado", "DEBITO VISA SUPERMERCADO XYZ"), 1);
  });
  it("ignora termos genéricos e devolve 0 sem informação útil", () => {
    assert.equal(descriptionSimilarity("Pix", "PIX ENVIADO"), 0);
    assert.equal(descriptionSimilarity(null, "QUALQUER COISA"), 0);
  });
});

describe("scorePair", () => {
  it("exige valor exato em centavos", () => {
    assert.equal(scorePair(line(0), provisional("a", { cents: 14999 })), null);
  });
  it("exige mesmo sentido (gasto × ganho)", () => {
    assert.equal(scorePair(line(0), provisional("a", { tipo: "ganho" })), null);
  });
  it("gasto_fixo casa com gasto do extrato", () => {
    assert.ok(scorePair(line(0), provisional("a", { tipo: "gasto_fixo" })));
  });
  it("respeita a tolerância de datas", () => {
    assert.ok(scorePair(line(0, { data: "2026-10-08" }), provisional("a")));
    assert.equal(scorePair(line(0, { data: "2026-10-09" }), provisional("a")), null);
  });
  it("gasto fixo gerado pelo sistema tem tolerância maior", () => {
    const fixo = provisional("a", {
      tipo: "gasto_fixo",
      gasto_fixo_id: "gf",
      descricao: "Mercado",
    });
    assert.ok(scorePair(line(0, { data: "2026-10-10" }), fixo));
  });
  it("não considera lançamento que já tem fitid (já conciliado/importado)", () => {
    assert.equal(scorePair(line(0), provisional("a", { fitid: "x" })), null);
  });
  it("é configurável", () => {
    const strict = { ...DEFAULT_MATCH_CONFIG, toleranciaDias: 0 };
    assert.equal(scorePair(line(0, { data: "2026-10-06" }), provisional("a"), strict), null);
  });
});

describe("planReconciliation", () => {
  it("concilia automaticamente o par inequívoco do exemplo do enunciado", () => {
    const plan = planReconciliation([line(0)], [provisional("p1")]);
    assert.equal(plan.automaticos.length, 1);
    assert.equal(plan.automaticos[0].provisionalId, "p1");
    assert.equal(plan.revisao.length + plan.novas.length, 0);
  });

  it("sem correspondência, a linha entra como nova", () => {
    const plan = planReconciliation([line(0, { cents: 9999 })], [provisional("p1")]);
    assert.equal(plan.novas.length, 1);
    assert.equal(plan.automaticos.length, 0);
  });

  it("dois provisórios idênticos para uma linha → revisão, nunca palpite", () => {
    const plan = planReconciliation([line(0)], [provisional("p1"), provisional("p2")]);
    assert.equal(plan.automaticos.length, 0);
    assert.equal(plan.revisao.length, 1);
    assert.equal(plan.revisao[0].candidatos.length, 2);
  });

  it("duas linhas idênticas para um provisório → ambas em revisão", () => {
    const plan = planReconciliation([line(0), line(1)], [provisional("p1")]);
    assert.equal(plan.automaticos.length, 0);
    assert.equal(plan.revisao.length, 2);
  });

  it("duas transações legítimas de mesma data e valor sem provisório continuam sendo duas novas", () => {
    const plan = planReconciliation([line(0), line(1)], []);
    assert.equal(plan.novas.length, 2);
  });

  it("diferença de data vai para revisão por padrão e pode ser aceita por configuração", () => {
    const shifted = line(0, { data: "2026-10-06" });
    assert.equal(planReconciliation([shifted], [provisional("p1")]).revisao.length, 1);

    const loose = { ...DEFAULT_MATCH_CONFIG, autoAceitarDivergenciaData: true };
    assert.equal(planReconciliation([shifted], [provisional("p1")], loose).automaticos.length, 1);
  });

  it("não usa o mesmo provisório em dois casamentos automáticos", () => {
    const plan = planReconciliation(
      [line(0), line(1, { data: "2026-10-20", descricao: "OUTRO" })],
      [provisional("p1")],
    );
    const used = plan.automaticos.map((match) => match.provisionalId);
    assert.equal(new Set(used).size, used.length);
  });
});

describe("resolvePlan", () => {
  const ambiguous = () => planReconciliation([line(0)], [provisional("p1"), provisional("p2")]);

  it("aplica a escolha do usuário e mantém a linha sem decisão fora da importação", () => {
    const decisions = new Map<number, ReviewDecision>([
      [0, { kind: "conciliar", provisionalId: "p2" }],
    ]);
    const final = resolvePlan(ambiguous(), decisions);
    assert.deepEqual(
      final.conciliacoes.map((item) => item.provisionalId),
      ["p2"],
    );

    const undecided = resolvePlan(ambiguous(), new Map());
    assert.equal(undecided.puladas.length, 1);
    assert.equal(undecided.novas.length, 0);
  });

  it("rejeitar mantém o provisório e importa a linha como nova", () => {
    const final = resolvePlan(
      ambiguous(),
      new Map<number, ReviewDecision>([[0, { kind: "nova" }]]),
    );
    assert.equal(final.novas.length, 1);
    assert.equal(final.conciliacoes.length, 0);
  });

  it("recusa conciliar dois extratos com o mesmo provisório", () => {
    const plan = planReconciliation([line(0), line(1)], [provisional("p1")]);
    const decisions = new Map<number, ReviewDecision>([
      [0, { kind: "conciliar", provisionalId: "p1" }],
      [1, { kind: "conciliar", provisionalId: "p1" }],
    ]);
    assert.throws(() => resolvePlan(plan, decisions));
  });

  it("recusa decisão para quem não é candidato", () => {
    const decisions = new Map<number, ReviewDecision>([
      [0, { kind: "conciliar", provisionalId: "zzz" }],
    ]);
    assert.throws(() => resolvePlan(ambiguous(), decisions));
  });
});
