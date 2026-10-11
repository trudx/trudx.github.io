import { toCents } from "./money.ts";
import type { FinanceiroNatureza, FinanceiroStatus, FinanceiroTipo, LedgerRow } from "./types.ts";

/** Forma mínima do registro do banco que as análises precisam (evita acoplar `lib/` aos hooks). */
export type LedgerSource = {
  id: string;
  data: string;
  tipo: FinanceiroTipo;
  valor: number | string;
  status: FinanceiroStatus;
  natureza: FinanceiroNatureza;
  banco_id: string | null;
  categoria_id: string | null;
  cliente_id: string | null;
  fitid: string | null;
  descricao: string | null;
  gasto_fixo_id: string | null;
};

/** `numeric` do Postgres pode chegar como string; sempre converte para centavos inteiros. */
export function toLedgerRow(record: LedgerSource): LedgerRow {
  return {
    id: record.id,
    data: record.data,
    tipo: record.tipo,
    cents: toCents(Number(record.valor)),
    status: record.status,
    natureza: record.natureza,
    banco_id: record.banco_id,
    categoria_id: record.categoria_id,
    cliente_id: record.cliente_id,
    fitid: record.fitid,
    descricao: record.descricao,
    gasto_fixo_id: record.gasto_fixo_id,
  };
}

export type Origem = "pdf" | "ofx" | "manual";

/** Origem do dado: extrato PDF, extrato OFX ou digitado à mão / gerado por gasto fixo. */
export function getOrigem(record: { fitid: string | null }): Origem {
  if (!record.fitid) return "manual";
  return record.fitid.startsWith("pdf-") ? "pdf" : "ofx";
}
