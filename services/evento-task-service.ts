//* Types Imports
import type { EventoInput } from "@/hooks/use-eventos";
import type { TaskInput } from "@/hooks/use-tasks";

type Persistence = {
  upsert: (table: string, rows: object[], options: { onConflict: string }) => Promise<unknown>;
  remove: (table: string, filters: { id: string; user_id: string }) => Promise<void>;
};

export function buildEventoTask(input: EventoInput, columnId: string): TaskInput {
  const end = new Date(input.data_fim);
  const dueDate = [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, "0"),
    String(end.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    title: input.titulo.trim(),
    description: [input.descricao.trim(), input.local.trim() ? `Local: ${input.local.trim()}` : ""]
      .filter(Boolean)
      .join("\n\n"),
    priority: "medium",
    column_id: columnId,
    cliente_id: input.cliente_id,
    average_duration_minutes: input.dia_inteiro
      ? 30
      : Math.max(1, Math.round((end.getTime() - new Date(input.data_inicio).getTime()) / 60000)),
    due_date: dueDate,
  };
}

export async function saveEventoWithTask(
  input: EventoInput,
  columnId: string,
  userId: string,
  creationId: string,
  persistence: Persistence,
) {
  if (!columnId) throw new Error("Escolha em qual coluna criar a tarefa.");

  const identity = { id: creationId, user_id: userId };
  await persistence.upsert(
    "eventos",
    [
      {
        ...input,
        ...identity,
        titulo: input.titulo.trim(),
        descricao: input.descricao.trim() || null,
        local: input.local.trim() || null,
      },
    ],
    { onConflict: "id" },
  );

  try {
    // O mesmo ID é reutilizado ao tentar novamente, inclusive se a resposta da API se perder.
    await persistence.upsert("tasks", [{ ...buildEventoTask(input, columnId), ...identity }], {
      onConflict: "id",
    });
  } catch (error) {
    const cleanup = await Promise.allSettled([
      persistence.remove("tasks", identity),
      persistence.remove("eventos", identity),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) {
      throw new Error(
        "Não foi possível concluir o cadastro. O evento ou a tarefa podem ter sido salvos. Tente salvar novamente neste formulário para concluir sem duplicar.",
        { cause: error },
      );
    }
    throw error;
  }
}
