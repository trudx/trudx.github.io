import type { FinanceiroTipo } from "./types.ts";
import { normalizeDescription } from "./text.ts";

/**
 * Motor de conciliação: casa lançamentos provisórios (digitados à mão) com as linhas de um extrato
 * importado. É puro de propósito — o plano é calculado aqui (testável) e aplicado de forma atômica
 * por uma função SQL; nada aqui toca o banco.
 */

export type MatchConfig = {
  /** Diferença máxima de dias entre o lançamento manual e o extrato. */
  toleranciaDias: number;
  /** Gasto fixo gerado pelo sistema usa o dia de cobrança, que costuma divergir do débito real. */
  toleranciaDiasGastoFixo: number;
  /** Pontos máximos pela data (data idêntica) — cai linearmente até a tolerância. */
  pesoData: number;
  /** Pontos máximos pela semelhança de descrição. */
  pesoDescricao: number;
  /** Abaixo disso a linha nem é considerada candidata. */
  minimoCandidato: number;
  /** Para conciliar sem perguntar, o melhor (e único) candidato precisa de pelo menos isso. */
  minimoAutomatico: number;
  /** Se falso, qualquer diferença de data vai para revisão em vez de ser aplicada em silêncio. */
  autoAceitarDivergenciaData: boolean;
};

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  toleranciaDias: 3,
  toleranciaDiasGastoFixo: 5,
  pesoData: 50,
  pesoDescricao: 30,
  minimoCandidato: 35,
  minimoAutomatico: 50,
  autoAceitarDivergenciaData: false,
};

export type ImportedLine = {
  /** Posição da linha no lote importado — identifica a linha nos resultados. */
  index: number;
  data: string;
  cents: number;
  tipo: "gasto" | "ganho";
  descricao: string;
  fitid: string;
};

export type ProvisionalLine = {
  id: string;
  data: string;
  cents: number;
  tipo: FinanceiroTipo;
  descricao: string | null;
  fitid: string | null;
  gasto_fixo_id: string | null;
};

export type Candidate = {
  provisionalId: string;
  score: number;
  diasDiferenca: number;
};

export type ReconciliationPlan = {
  /** Casamentos seguros: único candidato, em ambos os sentidos. */
  automaticos: { line: ImportedLine; provisionalId: string; score: number }[];
  /** Linhas com mais de um candidato (ou com divergência) — dependem de decisão do usuário. */
  revisao: { line: ImportedLine; candidatos: Candidate[] }[];
  /** Linhas sem nenhum candidato — entram como lançamentos novos. */
  novas: ImportedLine[];
};

export type ReviewDecision =
  | { kind: "conciliar"; provisionalId: string }
  | { kind: "nova" }
  | { kind: "pular" };

export type FinalPlan = {
  novas: ImportedLine[];
  conciliacoes: { line: ImportedLine; provisionalId: string }[];
  puladas: ImportedLine[];
};

const GENERIC_TOKENS = new Set([
  "debito",
  "credito",
  "compra",
  "compras",
  "visa",
  "master",
  "mastercard",
  "elo",
  "pix",
  "ted",
  "doc",
  "transferencia",
  "transf",
  "pagamento",
  "pgto",
  "pag",
  "cartao",
  "recebido",
  "enviado",
  "tarifa",
  "com",
  "para",
  "de",
  "da",
  "do",
  "em",
  "no",
  "na",
  "ltda",
  "sa",
  "me",
]);

function tokens(text: string) {
  return normalizeDescription(text)
    .split(" ")
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !GENERIC_TOKENS.has(token));
}

/**
 * Semelhança 0..1: fração das palavras do lançamento manual que aparecem (inteiras ou como parte de
 * palavra) na descrição do extrato. "Mercado" casa com "SUPERMERCADO XYZ"; o inverso não é exigido,
 * porque a descrição do banco é sempre mais longa e ruidosa.
 */
export function descriptionSimilarity(manual: string | null, official: string) {
  const manualTokens = tokens(manual ?? "");
  const officialTokens = tokens(official);
  if (manualTokens.length === 0 || officialTokens.length === 0) return 0;

  const matched = manualTokens.filter((token) =>
    officialTokens.some(
      (candidate) =>
        candidate === token ||
        (token.length >= 4 && candidate.includes(token)) ||
        (candidate.length >= 4 && token.includes(candidate)),
    ),
  );
  return matched.length / manualTokens.length;
}

export function daysBetween(a: string, b: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(a) - parse(b)) / 86_400_000);
}

function sameDirection(a: FinanceiroTipo, b: FinanceiroTipo) {
  return (a === "ganho") === (b === "ganho");
}

function toleranceFor(provisional: ProvisionalLine, config: MatchConfig) {
  return provisional.gasto_fixo_id ? config.toleranciaDiasGastoFixo : config.toleranciaDias;
}

/** Pontua o par; `null` quando algum critério obrigatório (valor exato, tipo, janela de datas) falha. */
export function scorePair(
  line: ImportedLine,
  provisional: ProvisionalLine,
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): Candidate | null {
  if (provisional.fitid) return null;
  if (line.cents !== provisional.cents) return null;
  if (!sameDirection(line.tipo, provisional.tipo)) return null;

  const diasDiferenca = Math.abs(daysBetween(line.data, provisional.data));
  const tolerance = toleranceFor(provisional, config);
  if (diasDiferenca > tolerance) return null;

  const dateScore = config.pesoData * (1 - diasDiferenca / (tolerance + 1));
  const descScore =
    config.pesoDescricao * descriptionSimilarity(provisional.descricao, line.descricao);
  const score = Math.round(dateScore + descScore);
  if (score < config.minimoCandidato) return null;

  return { provisionalId: provisional.id, score, diasDiferenca };
}

/**
 * Monta o plano de conciliação do lote.
 *
 * Só concilia sozinho quando o par é inequívoco *nos dois sentidos*: a linha do extrato tem um único
 * candidato e esse candidato só serve para essa linha. Duas compras legítimas de mesmo valor e data
 * (uma delas provisória) caem, portanto, em revisão — nunca em um palpite.
 */
export function planReconciliation(
  lines: ImportedLine[],
  provisionals: ProvisionalLine[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): ReconciliationPlan {
  const candidatesByLine = new Map<number, Candidate[]>();
  const linesByProvisional = new Map<string, number[]>();

  for (const line of lines) {
    const candidates = provisionals
      .map((provisional) => scorePair(line, provisional, config))
      .filter((candidate): candidate is Candidate => candidate !== null)
      .sort((a, b) => b.score - a.score || a.diasDiferenca - b.diasDiferenca);

    candidatesByLine.set(line.index, candidates);
    for (const candidate of candidates) {
      linesByProvisional.set(candidate.provisionalId, [
        ...(linesByProvisional.get(candidate.provisionalId) ?? []),
        line.index,
      ]);
    }
  }

  const plan: ReconciliationPlan = { automaticos: [], revisao: [], novas: [] };

  for (const line of lines) {
    const candidates = candidatesByLine.get(line.index) ?? [];
    if (candidates.length === 0) {
      plan.novas.push(line);
      continue;
    }

    const [best] = candidates;
    const isUnambiguous =
      candidates.length === 1 && linesByProvisional.get(best.provisionalId)?.length === 1;
    const isSafe =
      best.score >= config.minimoAutomatico &&
      (best.diasDiferenca === 0 || config.autoAceitarDivergenciaData);

    if (isUnambiguous && isSafe)
      plan.automaticos.push({ line, provisionalId: best.provisionalId, score: best.score });
    else plan.revisao.push({ line, candidatos: candidates });
  }

  return plan;
}

/**
 * Junta o plano automático com as decisões do usuário. Garante a regra "uma linha do extrato só casa
 * com um lançamento e vice-versa": decisões que repetiriam um provisório já usado viram erro, e
 * linhas de revisão sem decisão ficam de fora (não são importadas até serem resolvidas).
 */
export function resolvePlan(
  plan: ReconciliationPlan,
  decisions: Map<number, ReviewDecision>,
): FinalPlan {
  const used = new Set(plan.automaticos.map((match) => match.provisionalId));
  const final: FinalPlan = {
    novas: [...plan.novas],
    conciliacoes: plan.automaticos.map(({ line, provisionalId }) => ({ line, provisionalId })),
    puladas: [],
  };

  for (const { line, candidatos } of plan.revisao) {
    const decision = decisions.get(line.index);
    if (!decision || decision.kind === "pular") {
      final.puladas.push(line);
      continue;
    }
    if (decision.kind === "nova") {
      final.novas.push(line);
      continue;
    }

    const isCandidate = candidatos.some(
      (candidate) => candidate.provisionalId === decision.provisionalId,
    );
    if (!isCandidate)
      throw new Error("Decisão aponta para um lançamento que não é candidato dessa linha.");
    if (used.has(decision.provisionalId)) {
      throw new Error(
        "Um lançamento provisório não pode ser conciliado com duas linhas do extrato.",
      );
    }
    used.add(decision.provisionalId);
    final.conciliacoes.push({ line, provisionalId: decision.provisionalId });
  }

  return final;
}
