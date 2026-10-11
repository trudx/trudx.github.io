/** Tipos puros do domínio financeiro. Sem imports de runtime: os módulos desta pasta rodam também no `node --test`. */

export type FinanceiroTipo = "gasto" | "gasto_fixo" | "ganho";

/** `provisorio` = lançado à mão aguardando o extrato; `conciliado` = provisório casado com o extrato oficial. */
export type FinanceiroStatus = "provisorio" | "confirmado" | "conciliado";

/**
 * `transferencia` e `pagamento_fatura` são movimentações internas: ficam no extrato e no saldo do banco,
 * mas não entram em receitas/despesas. `estorno` abate da categoria de despesa em vez de virar receita.
 */
export type FinanceiroNatureza = "normal" | "transferencia" | "pagamento_fatura" | "estorno";

/** Visão mínima de um lançamento para cálculos. Valor sempre em centavos inteiros e positivo. */
export type LedgerRow = {
  id: string;
  data: string;
  tipo: FinanceiroTipo;
  cents: number;
  status: FinanceiroStatus;
  natureza: FinanceiroNatureza;
  banco_id: string | null;
  categoria_id: string | null;
  cliente_id: string | null;
  fitid: string | null;
  descricao: string | null;
  gasto_fixo_id: string | null;
};
