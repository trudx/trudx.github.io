import type { FinanceiroNatureza } from "./types.ts";
import { normalizeDescription } from "./text.ts";

export const NATUREZA_LABELS: Record<FinanceiroNatureza, string> = {
  normal: "Receita / despesa",
  transferencia: "Transferência entre contas",
  pagamento_fatura: "Pagamento de fatura",
  estorno: "Estorno / devolução",
};

/**
 * Sugere a natureza de uma linha do extrato a partir da descrição. É só um palpite pré-selecionado
 * na revisão da importação — nunca é aplicado sem o usuário poder trocar.
 */
export function suggestNatureza(descricao: string): FinanceiroNatureza {
  const text = normalizeDescription(descricao);
  if (/\b(estorno|estornado|devolucao|devolvido|reembolso)\b/.test(text)) return "estorno";
  if (
    /\b(pagamento|pgto|pag)\b.*\b(fatura|cartao)\b|\bfatura\b.*\b(cartao|nubank|santander)\b/.test(
      text,
    )
  ) {
    return "pagamento_fatura";
  }
  if (/\b(transferencia|transf)\b.*\b(entre contas|mesma titularidade|propria)\b/.test(text)) {
    return "transferencia";
  }
  return "normal";
}
