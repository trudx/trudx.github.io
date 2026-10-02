export type PdfTextItem = { str: string; x: number; y: number; width: number };

export type PdfStatementTransaction = {
  fitid: string;
  data: string;
  valor: number;
  descricao: string;
  tipoSugerido: "gasto" | "ganho";
};

export type PdfStatementResult = {
  transactions: PdfStatementTransaction[];
  warnings: string[];
};

type RawTransaction = {
  date: string;
  cents: number;
  explicitSign: 1 | -1 | 0;
  descParts: string[];
  section: number;
};

type Checkpoint = { afterIndex: number; saldo: number };

type Columns = { dateThreshold: number; saldoThreshold: number | null };

type Line = { y: number; items: PdfTextItem[] };

const MONEY_REGEX = /^-?\d{1,3}(?:\.\d{3})*,\d{2}-?$|^-?\d+,\d{2}-?$/;
const DOCUMENT_REGEX = /^\d{5,}$/;
const DATE_REGEX = /^(\d{2})\/(\d{2})$/;
const LINE_TOLERANCE = 3;
const MAX_FREE_SIGNS = 16;
const FOOTER_REGEX = /VALORES DEDUZIDOS|COMPRAS COM CARTAO|EXTRATO_PF|BALP_|[.]PIM/;

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const CREDIT_HINT = /RECEBID|REMUNERACAO|CREDITO|DEPOSITO|ESTORNO|RENDIMENTO|RESGATE|SALARIO/;

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function parseMoney(token: string) {
  const negative = token.startsWith("-") || token.endsWith("-");
  const digits = token.replace(/[-.]/g, "").replace(",", "");
  return { cents: Number.parseInt(digits, 10), negative };
}

function groupLines(items: PdfTextItem[]): Line[] {
  const sorted = items
    .filter((item) => item.str.trim() !== "")
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }

  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => b.y - a.y);
}

function lineText(line: Line) {
  return line.items.map((item) => item.str.trim()).join(" ");
}

function detectColumns(line: Line): Columns | null {
  const items = line.items;
  const text = normalize(lineText(line));
  if (!text.includes("DATA") || !text.includes("DESCRICAO") || !text.includes("MOVIMENTO")) {
    return null;
  }

  const find = (needle: string) => items.find((item) => normalize(item.str).includes(needle));
  const dateItem = find("DATA");
  const descrItem = find("DESCRICAO");
  const movItem = find("MOVIMENTO");
  const saldoItem = find("SALDO");
  if (!dateItem || !descrItem || !movItem) return null;

  let saldoThreshold: number | null = null;
  if (saldoItem && saldoItem.x > movItem.x) {
    const movRight = Math.max(
      ...items
        .filter((item) => item.x >= movItem.x && item.x < saldoItem.x)
        .map((item) => item.x + item.width),
    );
    const saldoRight = Math.max(
      ...items.filter((item) => item.x >= saldoItem.x).map((item) => item.x + item.width),
    );
    saldoThreshold = (movRight + saldoRight) / 2;
  }

  return { dateThreshold: (dateItem.x + descrItem.x) / 2, saldoThreshold };
}

function findReference(pages: PdfTextItem[][]) {
  for (const items of pages) {
    const text = normalize(items.map((item) => item.str).join(" ")).toLowerCase();
    const match = text.match(
      /(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/\s*(\d{4})/,
    );
    if (match) return { month: MONTHS[match[1]], year: Number.parseInt(match[2], 10) };
  }
  return null;
}

function guessSign(description: string): 1 | -1 {
  return CREDIT_HINT.test(normalize(description)) ? 1 : -1;
}

/** Descobre os sinais ambíguos fazendo a soma de cada trecho bater com o saldo impresso no extrato. */
function reconcileSigns(transactions: RawTransaction[], checkpoints: Checkpoint[]) {
  const signs: number[] = transactions.map(
    (transaction) => transaction.explicitSign || guessSign(transaction.descParts.join(" ")),
  );
  let failedSegments = 0;

  for (let index = 1; index < checkpoints.length; index++) {
    const from = checkpoints[index - 1].afterIndex;
    const to = checkpoints[index].afterIndex;
    if (to <= from) continue;

    const delta = checkpoints[index].saldo - checkpoints[index - 1].saldo;
    let total = 0;
    const free: number[] = [];
    for (let i = from; i < to; i++) {
      total += signs[i] * transactions[i].cents;
      if (!transactions[i].explicitSign) free.push(i);
    }
    if (total === delta) continue;

    if (free.length > MAX_FREE_SIGNS) {
      failedSegments++;
      continue;
    }

    let bestMask = -1;
    let bestFlips = Number.POSITIVE_INFINITY;
    for (let mask = 1; mask < 1 << free.length; mask++) {
      let flips = 0;
      let candidate = total;
      for (let bit = 0; bit < free.length; bit++) {
        if (mask & (1 << bit)) {
          flips++;
          candidate -= 2 * signs[free[bit]] * transactions[free[bit]].cents;
        }
      }
      if (candidate === delta && flips < bestFlips) {
        bestMask = mask;
        bestFlips = flips;
      }
    }

    if (bestMask < 0) {
      failedSegments++;
      continue;
    }
    for (let bit = 0; bit < free.length; bit++) {
      if (bestMask & (1 << bit)) signs[free[bit]] *= -1;
    }
  }

  return { signs, failedSegments };
}

function hashString(text: string) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function cleanDescription(parts: string[]) {
  return parts
    .map((part, index) => (index === 0 ? part : part.replace(/^\d{2}\/\d{2}\s+/, "")))
    .filter(Boolean)
    .join(" - ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê o texto posicionado de cada página de um extrato Santander e devolve os lançamentos sem duplicatas. */
export function parseSantanderPages(pages: PdfTextItem[][]): PdfStatementResult {
  const reference = findReference(pages);
  const referenceYear = reference?.year ?? new Date().getFullYear();
  const referenceMonth = reference?.month ?? 12;

  const raw: RawTransaction[] = [];
  const checkpoints: Checkpoint[] = [];
  let section = 0;
  let sectionHasTransactions = false;
  let lastDate: string | null = null;
  let lastMonthDay = 0;
  let columns: Columns | null = null;

  for (const items of pages) {
    let inTable = false;
    let current: RawTransaction | null = null;

    for (const line of groupLines(items)) {
      const headerColumns = detectColumns(line);
      if (headerColumns) {
        columns = headerColumns;
        inTable = true;
        continue;
      }
      if (!inTable || !columns) continue;

      const fullText = normalize(lineText(line));
      if (/^PAGINA\b/.test(fullText) || FOOTER_REGEX.test(fullText)) {
        inTable = false;
        current = null;
        continue;
      }

      const dateTokens: string[] = [];
      const moneyItems: { token: string; right: number }[] = [];
      const descParts: string[] = [];

      for (const item of line.items) {
        const token = item.str.trim();
        if (item.x < columns.dateThreshold && DATE_REGEX.test(token)) dateTokens.push(token);
        else if (MONEY_REGEX.test(token)) moneyItems.push({ token, right: item.x + item.width });
        else if (DOCUMENT_REGEX.test(token) || token === "-") continue;
        else descParts.push(token);
      }

      const description = descParts.join(" ").trim();

      // Linha de saldo: "SALDO EM dd/mm", ou só números/data sem descrição de lançamento.
      const isSaldoLine = /S\s*ALDO\s+EM\b/.test(fullText) || /^[\d\s/]*$/.test(description);
      if (isSaldoLine && moneyItems.length === 0) continue;

      if (isSaldoLine) {
        const saldoToken = moneyItems.at(-1)?.token;
        if (saldoToken) {
          const { cents, negative } = parseMoney(saldoToken);
          checkpoints.push({ afterIndex: raw.length, saldo: negative ? -cents : cents });
        }
        if (/S\s*ALDO\s+EM\b/.test(fullText) && sectionHasTransactions) {
          section++;
          sectionHasTransactions = false;
          lastMonthDay = 0;
        }
        if (/S[ ]*ALDO[ ]+EM/.test(fullText)) current = null;
        continue;
      }

      if (dateTokens.length > 0) {
        const [, day, month] = dateTokens[0].match(DATE_REGEX) ?? [];
        const monthDay = Number(month) * 100 + Number(day);
        if (monthDay < lastMonthDay && sectionHasTransactions) {
          section++;
          sectionHasTransactions = false;
        }
        lastMonthDay = monthDay;
        const year = Number(month) > referenceMonth ? referenceYear - 1 : referenceYear;
        lastDate = `${year}-${month}-${day}`;
      }

      let movement: string | null = null;
      let saldo: string | null = null;
      for (const money of moneyItems) {
        const isSaldo =
          columns.saldoThreshold !== null
            ? money.right > columns.saldoThreshold
            : moneyItems.length > 1 && money === moneyItems.at(-1);
        if (isSaldo) saldo = money.token;
        else movement = movement ?? money.token;
      }

      if (movement && lastDate) {
        const { cents, negative } = parseMoney(movement);
        current = {
          date: lastDate,
          cents,
          explicitSign: negative ? -1 : 0,
          descParts: description ? [description] : [],
          section,
        };
        raw.push(current);
        sectionHasTransactions = true;
      } else if (description && current && !saldo) {
        current.descParts.push(description);
      }

      if (saldo) {
        const { cents, negative } = parseMoney(saldo);
        checkpoints.push({ afterIndex: raw.length, saldo: negative ? -cents : cents });
      }
    }
  }

  const warnings: string[] = [];
  if (raw.length === 0) return { transactions: [], warnings };

  const { signs, failedSegments } = reconcileSigns(raw, checkpoints);
  if (failedSegments > 0) {
    warnings.push(
      `${failedSegments} trecho${failedSegments === 1 ? "" : "s"} do extrato não bateu com o saldo impresso — confira entradas e saídas antes de importar.`,
    );
  }

  const occurrences = new Map<string, number>();
  const unique = new Map<string, PdfStatementTransaction>();

  raw.forEach((transaction, index) => {
    const descricao = cleanDescription(transaction.descParts) || "Transação sem descrição";
    const baseKey = `${transaction.date}|${transaction.cents}|${normalize(descricao)}`;
    const occurrenceKey = `${transaction.section}|${baseKey}`;
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);

    // ID determinístico: reimportar o mesmo PDF (ou um PDF sobreposto) gera os mesmos fitid.
    const fitid = `pdf-${hashString(baseKey)}-${transaction.date}-${transaction.cents}-${occurrence}`;
    if (unique.has(fitid)) return;

    unique.set(fitid, {
      fitid,
      data: transaction.date,
      valor: transaction.cents / 100,
      descricao,
      tipoSugerido: signs[index] < 0 ? "gasto" : "ganho",
    });
  });

  return { transactions: [...unique.values()], warnings };
}

/** Extrai o texto posicionado de cada página do PDF e interpreta como extrato Santander. */
export async function parsePdfStatement(file: File): Promise<PdfStatementResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  const pages: PdfTextItem[][] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items.flatMap((item) =>
        "str" in item
          ? [{ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width }]
          : [],
      ),
    );
  }

  const fullText = normalize(pages.flat().map((item) => item.str).join(" "));
  if (!fullText.includes("SANTANDER")) {
    throw new Error("Esse PDF não parece ser um extrato do Santander (único banco suportado em PDF).");
  }

  const result = parseSantanderPages(pages);
  if (result.transactions.length === 0) {
    throw new Error("Nenhuma transação encontrada nesse PDF.");
  }
  return result;
}
