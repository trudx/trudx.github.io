"use client";

//* Services Imports
import { post, remove } from "@/services/api-service";

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
