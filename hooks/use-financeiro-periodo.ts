"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Services Imports
import { getAll } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { DateRange } from "@/lib/financeiro/analytics";
import type { LedgerRow } from "@/lib/financeiro/types";
import type { LedgerSource } from "@/lib/financeiro/ledger";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";
import { toLedgerRow } from "@/lib/financeiro/ledger";

const COLUMNS =
  "id,data,tipo,valor,status,natureza,banco_id,categoria_id,cliente_id,fitid,descricao,gasto_fixo_id";

/**
 * Lançamentos de um intervalo qualquer, já em centavos — usado para o período de comparação.
 * Traz todos os bancos/tipos: os filtros são aplicados depois, com o mesmo predicado da tabela, para
 * os dois períodos serem sempre comparados com os mesmos filtros.
 */
export function useFinanceiroPeriodo(range: DateRange) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { start, end } = range;

  const fetchRows = useCallback(async () => {
    setIsLoading(true);

    try {
      const userId = await getAuthenticatedUserId();
      const data = await getAll<LedgerSource>("financeiro", {
        select: COLUMNS,
        filters: { user_id: userId, data: { gte: start, lte: end } },
        order: [
          { column: "data", ascending: true },
          { column: "id", ascending: true },
        ],
      });
      setRows(data.map(toLedgerRow));
    } catch (error) {
      toast.error("Não foi possível carregar o período de comparação", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao carregar período de comparação:", error);
    } finally {
      setIsLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    // The request owns its loading state inside fetchRows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRows();
  }, [fetchRows]);

  return { rows, isLoading, refreshPeriodo: fetchRows };
}
