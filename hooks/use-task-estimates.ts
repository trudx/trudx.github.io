"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { get } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { TaskRecord } from "@/hooks/use-tasks";

export type TaskEstimate = Pick<TaskRecord, "id" | "average_duration_minutes">;

/**
 * Só id + tempo previsto de todas as tarefas, pro card de Otimização. O quadro é paginado e não
 * tem todas carregadas; esta consulta é leve (duas colunas) e não traz o resto da tarefa.
 */
export function useTaskEstimates() {
  const [estimates, setEstimates] = useState<TaskEstimate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEstimates = useCallback(async () => {
    try {
      const userId = await getAuthenticatedUserId();
      setEstimates(
        await get<TaskEstimate>("tasks", {
          select: "id,average_duration_minutes",
          filters: { user_id: userId },
        }),
      );
    } catch (error) {
      console.error("Erro ao carregar tempo previsto das tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAppDataRefresh(fetchEstimates, ["tasks"]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEstimates();
  }, [fetchEstimates]);

  return { estimates, isLoading, refreshEstimates: fetchEstimates };
}
