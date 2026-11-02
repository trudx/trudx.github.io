"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { rpc } from "@/services/api-service";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";

/** Contagens da Visão geral. As por data (hoje, amanhã, atrasadas) já ignoram as concluídas. */
export type TaskSummary = {
  dueToday: number;
  dueTomorrow: number;
  overdue: number;
  pending: number;
  inProgress: number;
  done: number;
  hasPendingColumn: boolean;
  hasDoneColumn: boolean;
};

type TaskSummaryRow = {
  due_today: number;
  due_tomorrow: number;
  overdue: number;
  pending: number;
  in_progress: number;
  done: number;
  has_pending_column: boolean;
  has_done_column: boolean;
};

const EMPTY_SUMMARY: TaskSummary = {
  dueToday: 0,
  dueTomorrow: 0,
  overdue: 0,
  pending: 0,
  inProgress: 0,
  done: 0,
  hasPendingColumn: false,
  hasDoneColumn: false,
};

/** `today` vem do relógio do usuário ("YYYY-MM-DD"), pra "hoje" ser o dia local e não o do banco. */
export function useTaskSummary(today: string) {
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const [row] = await rpc<TaskSummaryRow[]>("task_dashboard_summary", { p_today: today });
      if (!row) return;
      setSummary({
        dueToday: Number(row.due_today),
        dueTomorrow: Number(row.due_tomorrow),
        overdue: Number(row.overdue),
        pending: Number(row.pending),
        inProgress: Number(row.in_progress),
        done: Number(row.done),
        hasPendingColumn: row.has_pending_column,
        hasDoneColumn: row.has_done_column,
      });
    } catch (error) {
      toast.error("Não foi possível carregar o resumo das tarefas", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao carregar resumo de tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useAppDataRefresh(fetchSummary, ["tasks", "task_columns"]);

  useEffect(() => {
    // The initial request owns its loading state inside fetchSummary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading };
}
