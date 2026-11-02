"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { get, post, remove } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";

export type TaskPriority = "low" | "medium" | "high";

export type TaskRecord = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  column_id: string;
  cliente_id: string | null;
  average_duration_minutes: number;
  due_date: string;
  created_at: string;
  updated_at: string;
  /** Vem do vínculo `task_flag_links`, não de uma coluna da tabela `tasks`. */
  flag_ids: string[];
};

export type TaskInput = {
  title: string;
  description: string;
  priority: TaskPriority;
  column_id: string;
  cliente_id: string | null;
  average_duration_minutes: number;
  due_date: string;
};

/** Campos editáveis direto no card, sem abrir o formulário completo. */
export type TaskQuickPatch = Partial<Pick<TaskRecord, "priority" | "cliente_id">>;

export const TASK_SELECT =
  "id, user_id, title, description, priority, column_id, cliente_id, average_duration_minutes, due_date, created_at, updated_at, task_flag_links(flag_id)";

export type TaskRow = Omit<TaskRecord, "flag_ids"> & {
  task_flag_links: { flag_id: string }[] | null;
};

export function toTaskRecord({ task_flag_links, ...task }: TaskRow): TaskRecord {
  return { ...task, flag_ids: (task_flag_links ?? []).map((link) => link.flag_id) };
}

/** Deixa os vínculos da tarefa iguais a `flagIds`: remove o que saiu antes de inserir o que entrou (limite de 5 no banco). */
export async function syncTaskFlags(
  taskId: string,
  userId: string,
  currentIds: string[],
  flagIds: string[],
) {
  const removedIds = currentIds.filter((id) => !flagIds.includes(id));
  const addedIds = flagIds.filter((id) => !currentIds.includes(id));

  if (removedIds.length)
    await remove("task_flag_links", { task_id: taskId, flag_id: removedIds, user_id: userId });
  if (addedIds.length)
    await post(
      "task_flag_links",
      addedIds.map((flagId) => ({ task_id: taskId, flag_id: flagId, user_id: userId })),
      { select: "task_id" },
    );
}

/**
 * Lista TODAS as tarefas do usuário, sem paginação. Serve a visões de resumo (dashboard); o quadro
 * kanban usa `useTaskBoard`, que pagina por coluna.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);

    try {
      const userId = await getAuthenticatedUserId();
      const data = await get<TaskRow>("tasks", {
        select: TASK_SELECT,
        filters: { user_id: userId },
        order: [{ column: "created_at", ascending: false }],
      });
      setTasks(data.map(toTaskRecord));
    } catch (error) {
      toast.error("Não foi possível carregar as tarefas", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao listar tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAppDataRefresh(fetchTasks, ["tasks"]);

  useEffect(() => {
    // The initial request owns its loading state inside fetchTasks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTasks();
  }, [fetchTasks]);

  return { tasks, isLoading, refreshTasks: fetchTasks };
}
