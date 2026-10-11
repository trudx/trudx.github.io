import { toCents } from "./money.ts";
import type { ImportedLine } from "./reconciliation.ts";
import type { FinanceiroNatureza } from "./types.ts";

export type SourceTransaction = {
  fitid: string | null;
  data: string;
  valor: number;
  descricao: string;
};

export type SourceGroup = { key: string; transactions: SourceTransaction[] };

/** Escolhas do usuário na revisão de um grupo de transações. */
export type GroupChoice = {
  include: boolean;
  tipo: "gasto" | "ganho";
  cliente_id: string | null;
  natureza: FinanceiroNatureza;
  categoria_id: string | null;
};

export type LineMeta = Pick<GroupChoice, "cliente_id" | "natureza" | "categoria_id">;

function hash(text: string) {
  let value = 5381;
  for (let i = 0; i < text.length; i++) value = ((value << 5) + value + text.charCodeAt(i)) >>> 0;
  return value.toString(36);
}

/**
 * Identificador estável de uma transação. Extratos OFX sem FITID receberiam `null` e, sem
 * identificador, reimportar o arquivo duplicaria tudo — então ele é derivado do conteúdo, contando
 * ocorrências para que dois lançamentos legítimos idênticos continuem sendo dois.
 */
export function ensureFitids<T extends SourceTransaction>(
  transactions: T[],
): (Omit<T, "fitid"> & { fitid: string })[] {
  const occurrences = new Map<string, number>();

  return transactions.map((transaction) => {
    if (transaction.fitid) return { ...transaction, fitid: transaction.fitid };

    const base = `${transaction.data}|${toCents(transaction.valor)}|${transaction.descricao.trim().toLowerCase()}`;
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    return { ...transaction, fitid: `ofx-nofit-${hash(base)}-${occurrence}` };
  });
}

/** Linhas do extrato que o usuário marcou para importar, já com as escolhas do grupo aplicadas. */
export function buildImportLines(groups: SourceGroup[], choices: Record<string, GroupChoice>) {
  const lines: ImportedLine[] = [];
  const meta = new Map<number, LineMeta>();

  for (const group of groups) {
    const choice = choices[group.key];
    if (!choice?.include) continue;

    for (const transaction of ensureFitids(group.transactions)) {
      const index = lines.length;
      lines.push({
        index,
        data: transaction.data,
        cents: toCents(transaction.valor),
        tipo: choice.tipo,
        descricao: transaction.descricao,
        fitid: transaction.fitid,
      });
      meta.set(index, {
        cliente_id: choice.cliente_id,
        natureza: choice.natureza,
        categoria_id: choice.categoria_id,
      });
    }
  }

  return { lines, meta };
}
