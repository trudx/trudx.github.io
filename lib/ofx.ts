//* Libraries Imports
import { parseStrict, type ofxTypes } from "ofx-js";

//* Utils Imports
import { parseCsvStatement } from "@/lib/csv-statement";
import { parsePdfStatement } from "@/lib/pdf-statement";

export type OfxTransaction = {
  fitid: string | null;
  data: string;
  valor: number;
  descricao: string;
  tipoSugerido: "gasto" | "ganho";
};

/** Dados do extrato além das linhas: o que permite ancorar o saldo confirmado e saber a cobertura. */
export type StatementMeta = {
  formato: "ofx" | "pdf" | "csv";
  periodo: { inicio: string; fim: string } | null;
  /** Saldo impresso/informado pelo banco no fim do extrato. */
  saldoFinal: { data: string; valor: number } | null;
  /** OFX traz o saldo estruturado (confiável); no PDF ele é lido do texto e precisa de conferência. */
  saldoConfiavel: boolean;
};

export type OfxGroup = {
  key: string;
  descricao: string;
  valor: number;
  tipoSugerido: "gasto" | "ganho";
  transactions: OfxTransaction[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOfxDate(dtposted: string) {
  const year = dtposted.slice(0, 4);
  const month = dtposted.slice(4, 6);
  const day = dtposted.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function normalizeTransaction(transaction: ofxTypes.StatementTransaction): OfxTransaction {
  const valor = Number.parseFloat(transaction.TRNAMT);
  const descricao = (transaction.NAME || transaction.MEMO || "Transação sem descrição").trim();

  return {
    fitid: transaction.FITID || null,
    data: parseOfxDate(transaction.DTPOSTED),
    valor: Math.abs(valor),
    descricao,
    tipoSugerido: valor < 0 ? "gasto" : "ganho",
  };
}

function groupingKey(transaction: OfxTransaction) {
  return `${transaction.descricao.trim().toLowerCase()}::${transaction.valor.toFixed(2)}`;
}

function groupTransactions(transactions: OfxTransaction[]): OfxGroup[] {
  const groups = new Map<string, OfxGroup>();

  for (const transaction of transactions) {
    const key = groupingKey(transaction);
    const existing = groups.get(key);

    if (existing) {
      existing.transactions.push(transaction);
    } else {
      groups.set(key, {
        key,
        descricao: transaction.descricao,
        valor: transaction.valor,
        tipoSugerido: transaction.tipoSugerido,
        transactions: [transaction],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.transactions.length - a.transactions.length);
}

function ofxDateOnly(value: string | undefined) {
  return value && value.length >= 8 ? parseOfxDate(value) : null;
}

/** Lê um arquivo .ofx/.qfx e devolve as transações agrupadas por descrição+valor parecidos. */
export async function parseOfxFile(
  file: File,
): Promise<{ groups: OfxGroup[]; meta: StatementMeta }> {
  const text = await file.text();
  const parsed = parseStrict(text);

  const statementResponses = asArray(parsed.OFX.BANKMSGSRSV1?.STMTTRNRS);
  const rawTransactions = statementResponses.flatMap((response) =>
    asArray(response.STMTRS?.BANKTRANLIST?.STMTTRN),
  );

  if (rawTransactions.length === 0) {
    throw new Error("Nenhuma transação encontrada nesse arquivo OFX.");
  }

  const transactions = rawTransactions.map(normalizeTransaction);
  const dates = transactions.map((transaction) => transaction.data).sort();
  const statement = statementResponses[0]?.STMTRS;
  const list = statement?.BANKTRANLIST;
  const ledger = statement?.LEDGERBAL;
  const balanceDate = ofxDateOnly(ledger?.DTASOF);
  const balance = ledger ? Number.parseFloat(ledger.BALAMT) : Number.NaN;

  return {
    groups: groupTransactions(transactions),
    meta: {
      formato: "ofx",
      periodo: {
        inicio: ofxDateOnly(list?.DTSTART) ?? dates[0],
        fim: ofxDateOnly(list?.DTEND) ?? dates[dates.length - 1],
      },
      saldoFinal:
        balanceDate && Number.isFinite(balance) ? { data: balanceDate, valor: balance } : null,
      saldoConfiavel: true,
    },
  };
}

/** Lê um extrato (.ofx/.qfx, .csv ou .pdf do Santander) e devolve os grupos para revisão, os metadados e avisos de leitura. */
export async function parseStatementFile(file: File) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const { transactions, warnings, periodo } = await parseCsvStatement(file);
    return {
      groups: groupTransactions(transactions),
      warnings,
      // CSV não traz saldo: não há âncora para o saldo confirmado.
      meta: { formato: "csv", periodo, saldoFinal: null, saldoConfiavel: false } satisfies StatementMeta,
    };
  }

  if (!name.endsWith(".pdf")) {
    const { groups, meta } = await parseOfxFile(file);
    return { groups, meta, warnings: [] as string[] };
  }

  const { transactions, warnings, periodo, saldoFinal } = await parsePdfStatement(file);
  return {
    groups: groupTransactions(transactions),
    warnings,
    // Se algum trecho não bateu com o saldo impresso, o saldo lido do PDF também não merece confiança.
    meta: {
      formato: "pdf",
      periodo,
      saldoFinal,
      saldoConfiavel: warnings.length === 0,
    } satisfies StatementMeta,
  };
}
