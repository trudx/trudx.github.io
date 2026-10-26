"use client";

//* Libraries Imports
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { getAll, patch, post, remove } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { FinanceiroNatureza, FinanceiroStatus, FinanceiroTipo } from "@/lib/financeiro/types";

//* Utils Imports
import { getApiErrorMessage, isUniqueViolation } from "@/lib/api-error";

export type { FinanceiroNatureza, FinanceiroStatus, FinanceiroTipo };

export type FinanceiroRecord = {
  id: string;
  user_id: string;
  data: string;
  tipo: FinanceiroTipo;
  valor: number;
  descricao: string | null;
  cliente_id: string | null;
  gasto_fixo_id: string | null;
  banco_id: string | null;
  fitid: string | null;
  status: FinanceiroStatus;
  natureza: FinanceiroNatureza;
  categoria_id: string | null;
  lote_id: string | null;
  conciliado_em: string | null;
  /** Dados exatamente como vieram do extrato, quando o lançamento foi conciliado. */
  dados_originais: {
    data: string;
    descricao: string;
    valor: number;
    tipo: string;
    fitid: string;
  } | null;
  created_at: string;
};

export type FinanceiroInput = {
  data: string;
  tipo: "gasto" | "ganho";
  valor: number;
  descricao: string;
  cliente_id: string | null;
  banco_id: string | null;
  fitid?: string | null;
  status?: FinanceiroStatus;
  natureza?: FinanceiroNatureza;
  categoria_id?: string | null;
};

export type FinanceiroEditInput = Pick<FinanceiroInput, "descricao" | "cliente_id" | "banco_id"> &
  Partial<Pick<FinanceiroRecord, "categoria_id" | "natureza" | "status">>;

export type PeriodFilter = { mode: "month"; month: string } | { mode: "range"; start: string; end: string };

const TABLE = "financeiro";
export const FINANCEIRO_SELECT_COLUMNS =
  "id,user_id,data,tipo,valor,descricao,cliente_id,gasto_fixo_id,banco_id,fitid,status,natureza,categoria_id,lote_id,conciliado_em,dados_originais,created_at";
const SELECT_COLUMNS = FINANCEIRO_SELECT_COLUMNS;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function getPeriodRange(period: PeriodFilter) {
  if (period.mode === "range") return { start: period.start, end: period.end };

  const [year, month] = period.month.split("-").map(Number);
  const start = `${period.month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${period.month}-${pad(lastDay)}`;
  return { start, end };
}

/** Últimos `days` dias contando hoje, no formato que o `PeriodFilter` espera. */
export function getLastDaysPeriod(days: number): PeriodFilter {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
  const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { mode: "range", start: toIso(start), end: toIso(end) };
}

function duplicateKey(data: string, valor: number, descricao: string) {
  return `${data}::${valor.toFixed(2)}::${descricao.trim().toLowerCase()}`;
}

export function useFinanceiro(initialPeriod?: PeriodFilter) {
  const [allRecords, setAllRecords] = useState<FinanceiroRecord[]>([]);
  const [tipoFilter, setTipoFilter] = useState<FinanceiroTipo | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    initialPeriod ?? { mode: "month", month: getCurrentMonthValue() },
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Buscado por período (não por tipo), pra que os cards agrupados por termo vejam todos os tipos.
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);

    try {
      const userId = await getAuthenticatedUserId();
      const { start, end } = getPeriodRange(periodFilter);
      const data = await getAll<FinanceiroRecord>(TABLE, {
        select: SELECT_COLUMNS,
        filters: { user_id: userId, data: { gte: start, lte: end } },
        order: [
          { column: "data", ascending: false },
          { column: "created_at", ascending: false },
          { column: "id", ascending: true },
        ],
      });

      setAllRecords(data);
    } catch (error) {
      toast.error("Não foi possível carregar o financeiro", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao listar lançamentos financeiros:", error);
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter]);

  const records = useMemo(
    () => (tipoFilter === "all" ? allRecords : allRecords.filter((record) => record.tipo === tipoFilter)),
    [allRecords, tipoFilter],
  );

  useAppDataRefresh(fetchRecords, ["financeiro", "gastos_fixos"]);

  useEffect(() => {
    // The initial (and every filter-change) request owns its loading state inside fetchRecords.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRecords();
  }, [fetchRecords]);

  async function createRecord(input: FinanceiroInput) {
    setIsSaving(true);

    try {
      const userId = await getAuthenticatedUserId();
      await post(TABLE, { ...input, descricao: input.descricao.trim() || null, user_id: userId });

      await fetchRecords();
      toast.success("Lançamento cadastrado");
      return true;
    } catch (error) {
      toast.error(
        isUniqueViolation(error) ? "Esse lançamento já foi importado" : "Não foi possível cadastrar o lançamento",
        {
          description: isUniqueViolation(error)
            ? "Essa transação do extrato já está no financeiro."
            : getApiErrorMessage(error, "Confira os dados e tente novamente."),
        },
      );
      console.error("Erro ao cadastrar lançamento financeiro:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  /** Entre os lançamentos informados, devolve os que já existem no financeiro (mesma data, valor e descrição). */
  async function findDuplicates(inputs: FinanceiroInput[]) {
    if (inputs.length === 0) return [] as FinanceiroInput[];

    try {
      const userId = await getAuthenticatedUserId();
      const dates = inputs.map((input) => input.data);
      const minDate = dates.reduce((min, date) => (date < min ? date : min));
      const maxDate = dates.reduce((max, date) => (date > max ? date : max));

      const data = await getAll<Pick<FinanceiroRecord, "data" | "valor" | "descricao">>(TABLE, {
        select: "data,valor,descricao",
        filters: { user_id: userId, data: { gte: minDate, lte: maxDate } },
        order: [{ column: "id", ascending: true }],
      });

      const existingKeys = new Set(
        data.map((record) => duplicateKey(record.data, record.valor, record.descricao ?? "")),
      );

      return inputs.filter((input) => existingKeys.has(duplicateKey(input.data, input.valor, input.descricao)));
    } catch (error) {
      toast.error("Não foi possível checar lançamentos duplicados", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao checar lançamentos duplicados:", error);
      return [];
    }
  }

  /** Lançamentos do banco e período escolhidos, usados para a IA comparar com o extrato que está sendo importado. */
  async function findExistingInRange(minDate: string, maxDate: string, bancoId: string) {
    try {
      const userId = await getAuthenticatedUserId();
      const data = await getAll<Pick<FinanceiroRecord, "id" | "data" | "tipo" | "valor" | "descricao">>(TABLE, {
        select: "id,data,tipo,valor,descricao",
        filters: { user_id: userId, banco_id: bancoId, data: { gte: minDate, lte: maxDate } },
        order: [
          { column: "data", ascending: true },
          { column: "id", ascending: true },
        ],
      });
      return data.map((record) => ({
        id: record.id,
        data: record.data,
        tipo: record.tipo === "ganho" ? ("ganho" as const) : ("gasto" as const),
        valor: record.valor,
        descricao: record.descricao ?? "",
      }));
    } catch (error) {
      console.error("Erro ao buscar lançamentos para a checagem da IA:", error);
      return null;
    }
  }

  /** Edita descrição, cliente, banco, categoria, natureza e status (valor, data e tipo não mudam). */
  async function updateRecord(id: string, input: FinanceiroEditInput) {
    setIsSaving(true);

    try {
      const userId = await getAuthenticatedUserId();
      const changes = { ...input, descricao: input.descricao.trim() || null };
      const [updated] = await patch<FinanceiroRecord>(TABLE, changes, { id, user_id: userId });
      if (!updated) throw new Error("Nenhum lançamento foi atualizado (verifique a policy de update).");

      setAllRecords((current) => current.map((record) => (record.id === id ? { ...record, ...changes } : record)));
      toast.success("Lançamento atualizado");
      return true;
    } catch (error) {
      toast.error("Não foi possível atualizar o lançamento", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao atualizar lançamento financeiro:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    setDeletingId(id);

    try {
      const userId = await getAuthenticatedUserId();
      await remove(TABLE, { id, user_id: userId });

      setAllRecords((current) => current.filter((record) => record.id !== id));
      toast.success("Lançamento excluído");
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir o lançamento", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao excluir lançamento financeiro:", error);
      return false;
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteRecords(ids: string[]) {
    if (ids.length === 0) return false;

    setIsBulkDeleting(true);

    try {
      const userId = await getAuthenticatedUserId();
      await remove(TABLE, { id: ids, user_id: userId });

      const idSet = new Set(ids);
      setAllRecords((current) => current.filter((record) => !idSet.has(record.id)));
      toast.success(`${ids.length} lançamento${ids.length === 1 ? "" : "s"} excluído${ids.length === 1 ? "" : "s"}`);
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir os lançamentos", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao excluir lançamentos financeiros em lote:", error);
      return false;
    } finally {
      setIsBulkDeleting(false);
    }
  }

  return {
    records,
    allRecords,
    tipoFilter,
    setTipoFilter,
    periodFilter,
    setPeriodFilter,
    isLoading,
    isSaving,
    deletingId,
    isBulkDeleting,
    createRecord,
    findDuplicates,
    findExistingInRange,
    updateRecord,
    deleteRecord,
    deleteRecords,
    refreshRecords: fetchRecords,
  };
}
