/**
 * Saldo confirmado × estimado.
 *
 * O Postgres (RPC `financeiro_saldos`) soma por banco; aqui só se combina. Regras:
 * - Com saldo de referência (extrato validado): confirmado = referência + movimentos oficiais depois
 *   dela; estimado = referência + todos os movimentos depois dela (incluindo provisórios).
 * - Sem referência: não existe saldo bancário validado — o valor é só o somatório do histórico e é
 *   rotulado como "calculado".
 * Lançamento conciliado é uma única linha, então nunca é contado duas vezes.
 */

export type SaldoBancoRow = {
  banco_id: string | null;
  ref_data: string | null;
  ref_saldo_cents: number | null;
  /** Movimentos com `fitid` (vindos de extrato) depois da referência. */
  mov_oficial_cents: number;
  /** Todos os movimentos depois da referência, exceto provisórios anteriores a ela. */
  mov_total_cents: number;
  /** Histórico inteiro, usado quando não há referência. */
  total_cents: number;
  provisorios_qtd: number;
  provisorios_cents: number;
  /** Provisórios com data até a referência: o extrato já cobre o dia e eles não casaram. */
  provisorios_obsoletos_qtd: number;
  ultima_cobertura: string | null;
};

export type BankBalance = {
  bancoId: string | null;
  kind: "bancario" | "calculado";
  /** `null` quando não há saldo bancário validado. */
  confirmado: number | null;
  estimado: number;
  /** Parte do estimado que ainda não está confirmada por extrato. */
  naoConfirmado: number;
  refData: string | null;
  provisoriosQtd: number;
  provisoriosCents: number;
  obsoletosQtd: number;
  ultimaCobertura: string | null;
};

export function computeBankBalance(row: SaldoBancoRow): BankBalance {
  const base = {
    bancoId: row.banco_id,
    provisoriosQtd: row.provisorios_qtd,
    provisoriosCents: row.provisorios_cents,
    obsoletosQtd: row.provisorios_obsoletos_qtd,
    ultimaCobertura: row.ultima_cobertura,
    refData: row.ref_data,
  };

  if (row.ref_data === null || row.ref_saldo_cents === null) {
    return {
      ...base,
      kind: "calculado",
      confirmado: null,
      estimado: row.total_cents,
      naoConfirmado: row.total_cents,
    };
  }

  const confirmado = row.ref_saldo_cents + row.mov_oficial_cents;
  const estimado = row.ref_saldo_cents + row.mov_total_cents;
  return { ...base, kind: "bancario", confirmado, estimado, naoConfirmado: estimado - confirmado };
}

export type ConsolidatedBalance = {
  estimado: number;
  /** Soma só dos bancos que têm saldo validado. */
  confirmado: number | null;
  naoConfirmado: number;
  provisoriosQtd: number;
  provisoriosCents: number;
  obsoletosQtd: number;
  /** Bancos cujo saldo é apenas calculado — o consolidado fica parcial por causa deles. */
  bancosSemReferencia: (string | null)[];
  isCompleto: boolean;
  ultimaCoberturaPorBanco: Map<string | null, string | null>;
};

export function consolidateBalances(banks: BankBalance[]): ConsolidatedBalance {
  const validated = banks.filter((bank) => bank.kind === "bancario");
  const calculated = banks.filter((bank) => bank.kind === "calculado");

  return {
    estimado: banks.reduce((sum, bank) => sum + bank.estimado, 0),
    confirmado:
      validated.length > 0
        ? validated.reduce((sum, bank) => sum + (bank.confirmado ?? 0), 0)
        : null,
    // Só bancos com saldo validado: num banco só "calculado" nada é confirmado, então "pendente" não faz sentido.
    naoConfirmado: validated.reduce((sum, bank) => sum + bank.naoConfirmado, 0),
    provisoriosQtd: banks.reduce((sum, bank) => sum + bank.provisoriosQtd, 0),
    provisoriosCents: banks.reduce((sum, bank) => sum + bank.provisoriosCents, 0),
    obsoletosQtd: banks.reduce((sum, bank) => sum + bank.obsoletosQtd, 0),
    bancosSemReferencia: calculated.map((bank) => bank.bancoId),
    isCompleto: calculated.length === 0 && banks.length > 0,
    ultimaCoberturaPorBanco: new Map(banks.map((bank) => [bank.bancoId, bank.ultimaCobertura])),
  };
}
