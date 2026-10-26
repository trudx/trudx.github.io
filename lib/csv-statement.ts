//* Types Imports
import type { OfxTransaction } from "@/lib/ofx";

export type CsvStatementResult = {
  transactions: OfxTransaction[];
  warnings: string[];
  periodo: { inicio: string; fim: string } | null;
};

type ColumnMap = {
  data: number;
  descricao: number;
  valor: number | null;
  credito: number | null;
  debito: number | null;
  tipo: number | null;
};

const DATE_HEADERS = ["data", "date", "dt", "data lancamento", "data movimentacao", "data da transacao"];
const DESCRIPTION_HEADERS = ["descricao", "description", "historico", "memo", "lancamento", "detalhes", "estabelecimento", "name", "nome"];
const VALUE_HEADERS = ["valor", "value", "amount", "quantia", "montante"];
const CREDIT_HEADERS = ["credito", "credit", "entrada", "entradas"];
const DEBIT_HEADERS = ["debito", "debit", "saida", "saidas"];
const TYPE_HEADERS = ["tipo", "type", "natureza"];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase();
}

function detectDelimiter(headerLine: string) {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/** Quote-aware CSV reader: handles escaped quotes ("") and line breaks inside quoted fields. */
function parseRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

function findColumn(headers: string[], names: string[]) {
  const exact = headers.findIndex((header) => names.includes(header));
  if (exact >= 0) return exact;
  const partial = headers.findIndex((header) => names.some((name) => header.startsWith(name)));
  return partial >= 0 ? partial : null;
}

function mapColumns(headers: string[]): ColumnMap | null {
  const data = findColumn(headers, DATE_HEADERS);
  const descricao = findColumn(headers, DESCRIPTION_HEADERS);
  const valor = findColumn(headers, VALUE_HEADERS);
  const credito = findColumn(headers, CREDIT_HEADERS);
  const debito = findColumn(headers, DEBIT_HEADERS);

  if (data === null || descricao === null) return null;
  if (valor === null && credito === null && debito === null) return null;

  return { data, descricao, valor, credito, debito, tipo: findColumn(headers, TYPE_HEADERS) };
}

function parseDate(raw: string) {
  const value = raw.trim();

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/);
  if (!br) return null;

  const year = br[3].length === 2 ? `20${br[3]}` : br[3];
  const month = br[2].padStart(2, "0");
  const day = br[1].padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;

  return `${year}-${month}-${day}`;
}

/** Accepts "1.234,56", "1234.56", "R$ -12,30", "(45,00)" and "12,30-"; returns null when it is not a number. */
function parseAmount(raw: string) {
  let value = raw.replace(/R\$|\s/g, "");
  if (value === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  // The last separator is the decimal one; any other separator is a thousands mark.
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
  else value = value.replace(/,/g, "");

  if (!/^\d+(\.\d+)?$/.test(value)) return null;

  const number = Number.parseFloat(value);
  return negative ? -number : number;
}

function isDebitLabel(label: string) {
  const normalized = normalizeHeader(label);
  return /^(gasto|debito|saida|despesa|d)/.test(normalized);
}

function isCreditLabel(label: string) {
  const normalized = normalizeHeader(label);
  return /^(ganho|credito|entrada|receita|c$)/.test(normalized);
}

/**
 * Reads a bank CSV export. Needs a header row with a date, a description and either a single
 * signed amount column or separate credit/debit columns. Negative amounts are expenses.
 */
export async function parseCsvStatement(file: File): Promise<CsvStatementResult> {
  const text = (await file.text()).replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const rows = parseRows(text, detectDelimiter(firstLine));

  // Some banks print account info above the table, so the header is the first row that maps.
  let headerIndex = -1;
  let columns: ColumnMap | null = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    columns = mapColumns(rows[i].map(normalizeHeader));
    if (columns) {
      headerIndex = i;
      break;
    }
  }

  if (!columns) {
    throw new Error(
      "Não encontrei as colunas do CSV. O arquivo precisa de cabeçalho com data, descrição e valor (ou crédito/débito).",
    );
  }

  const transactions: OfxTransaction[] = [];
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const data = parseDate(row[columns.data] ?? "");
    const descricao = (row[columns.descricao] ?? "").trim();
    let valor: number | null = null;

    if (columns.valor !== null) {
      valor = parseAmount(row[columns.valor] ?? "");
      // With an explicit type column, an unsigned amount takes its direction from the label.
      if (valor !== null && valor > 0 && columns.tipo !== null) {
        const label = row[columns.tipo] ?? "";
        if (isDebitLabel(label) && !isCreditLabel(label)) valor = -valor;
      }
    } else {
      const credito = columns.credito === null ? null : parseAmount(row[columns.credito] ?? "");
      const debito = columns.debito === null ? null : parseAmount(row[columns.debito] ?? "");
      if (credito) valor = Math.abs(credito);
      else if (debito) valor = -Math.abs(debito);
    }

    if (!data || valor === null || valor === 0) {
      skipped++;
      continue;
    }

    transactions.push({
      fitid: null,
      data,
      valor: Math.abs(valor),
      descricao: descricao || "Transação sem descrição",
      tipoSugerido: valor < 0 ? "gasto" : "ganho",
    });
  }

  if (transactions.length === 0) {
    throw new Error("Nenhuma transação válida encontrada nesse arquivo CSV.");
  }

  const dates = transactions.map((transaction) => transaction.data).sort();
  const warnings =
    skipped > 0 ? [`${skipped} linha(s) do CSV foram ignoradas por não ter data ou valor válidos.`] : [];

  return {
    transactions,
    warnings,
    periodo: { inicio: dates[0], fim: dates[dates.length - 1] },
  };
}
