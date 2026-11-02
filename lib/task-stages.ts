//* Types Imports
import type { TaskColumnRecord, TaskColumnStage } from "@/hooks/use-task-columns";

/**
 * Etapa do card conforme a posição da coluna em relação às colunas-marco:
 * - `pending`: a coluna de pendência e todas antes dela;
 * - `done`: a coluna de conclusão e todas depois dela;
 * - `progress`: o resto (o que está em andamento).
 *
 * Se as duas marcas se cruzarem na ordem, conclusão vence. Sem marca, tudo é `progress`.
 */
export type TaskStage = "pending" | "progress" | "done";

export const taskColumnStageLabels: Record<TaskColumnStage, string> = {
  pending: "Pendência",
  done: "Conclusão",
};

/** `columns` precisa vir ordenado por `position`, como o hook entrega. */
export function getStageByColumnId(columns: TaskColumnRecord[]) {
  const pendingIndex = columns.findIndex((column) => column.stage === "pending");
  const doneIndex = columns.findIndex((column) => column.stage === "done");

  return Object.fromEntries(
    columns.map((column, index): [string, TaskStage] => {
      if (doneIndex >= 0 && index >= doneIndex) return [column.id, "done"];
      if (pendingIndex >= 0 && index <= pendingIndex) return [column.id, "pending"];
      return [column.id, "progress"];
    }),
  );
}
