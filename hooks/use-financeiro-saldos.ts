"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { get, remove, rpc, upsert } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { SaldoBancoRow, SaldoResponse } from "@/lib/financeiro/balance";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";
import { toSaldoBancoRow } from "@/lib/financeiro/balance";

export type SaldoReferenciaRecord = {
  id: string;
  banco_id: string;
  data: string;
  saldo: number | string;
  origem: "pdf" | "ofx" | "manual";
};

/**
 * Saldos por banco em duas datas: hoje e o dia anterior ao início do período (ponto de partida do
 * gráfico de evolução). A soma é feita no Postgres — a API corta respostas em 1000 linhas, então
 * somar o histórico no cliente seria silenciosamente errado.
 */
export function useFinanceiroSaldos(today: string, dayBeforePeriod: string) {
  const [hoje, setHoje] = useState<SaldoBancoRow[]>([]);
  const [inicio, setInicio] = useState<SaldoBancoRow[]>([]);
  const [referencias, setReferencias] = useState<SaldoReferenciaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchSaldos = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const userId = await getAuthenticatedUserId();
      const [nowRows, startRows, refs] = await Promise.all([
        rpc<SaldoResponse[]>("financeiro_saldos", { p_ate: today }),
        rpc<SaldoResponse[]>("financeiro_saldos", { p_ate: dayBeforePeriod }),
        get<SaldoReferenciaRecord>("financeiro_saldos_referencia", {
          select: "id,banco_id,data,saldo,origem",
          filters: { user_id: userId },
          order: [{ column: "data", ascending: false }],
        }),
      ]);

      setHoje((nowRows ?? []).map(toSaldoBancoRow));
      setInicio((startRows ?? []).map(toSaldoBancoRow));
      setReferencias(refs);
    } catch (error) {
      setHasError(true);
      toast.error("Não foi possível calcular os saldos", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao calcular saldos do financeiro:", error);
    } finally {
      setIsLoading(false);
    }
  }, [today, dayBeforePeriod]);

  useAppDataRefresh(fetchSaldos, [
    "financeiro",
    "financeiro_saldos_referencia",
    "bancos",
    "gastos_fixos",
  ]);

  useEffect(() => {
    // The request owns its loading state inside fetchSaldos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSaldos();
  }, [fetchSaldos]);

  /** Informa à mão o saldo que o banco mostra numa data (cria a âncora do saldo confirmado). */
  async function saveReferencia(bancoId: string, data: string, saldo: number) {
    try {
      const userId = await getAuthenticatedUserId();
      await upsert(
        "financeiro_saldos_referencia",
        [{ user_id: userId, banco_id: bancoId, data, saldo, origem: "manual" }],
        {
          onConflict: "user_id,banco_id,data",
        },
      );
      await fetchSaldos();
      toast.success("Saldo de referência salvo");
      return true;
    } catch (error) {
      toast.error("Não foi possível salvar o saldo de referência", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao salvar saldo de referência:", error);
      return false;
    }
  }

  async function deleteReferencia(id: string) {
    try {
      const userId = await getAuthenticatedUserId();
      await remove("financeiro_saldos_referencia", { id, user_id: userId });
      await fetchSaldos();
      toast.success("Saldo de referência removido");
      return true;
    } catch (error) {
      toast.error("Não foi possível remover o saldo de referência", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao remover saldo de referência:", error);
      return false;
    }
  }

  return {
    hoje,
    inicio,
    referencias,
    isLoading,
    hasError,
    saveReferencia,
    deleteReferencia,
    refreshSaldos: fetchSaldos,
  };
}
