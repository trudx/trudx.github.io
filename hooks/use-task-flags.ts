"use client";

//* Libraries Imports
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { notifyAppDataChanged, useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { get, patch, post, remove, rpc } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Utils Imports
import { getApiErrorMessage, isUniqueViolation } from "@/lib/api-error";

export type TaskFlagRecord = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type TaskFlagInput = Pick<TaskFlagRecord, "name" | "color">;

export const MAX_FLAGS_PER_TASK = 5;

// Tons 600 do Tailwind: todos seguram texto branco com contraste, tanto no tema claro quanto no escuro.
export const TASK_FLAG_COLORS = [
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#0284c7",
  "#4f46e5",
  "#9333ea",
  "#db2777",
  "#475569",
];

export function useTaskFlags() {
  const [flags, setFlags] = useState<TaskFlagRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [taskCountByFlagId, setTaskCountByFlagId] = useState<Record<string, number>>({});

  const fetchFlags = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = await getAuthenticatedUserId();
      const data = await get<TaskFlagRecord>("task_flags", {
        select: "id,user_id,name,color,created_at",
        filters: { user_id: userId },
        order: [{ column: "name", ascending: true }],
      });
      setFlags(data);
    } catch (error) {
      toast.error("Não foi possível carregar as flags", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao listar flags de tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useAppDataRefresh(fetchFlags, ["task_flags"]);

  // O quadro é paginado, então a contagem por flag vem do banco; é chamada ao abrir o modal.
  const fetchFlagCounts = useCallback(async () => {
    try {
      const rows = await rpc<{ flag_id: string; total: number }[]>("task_flag_counts");
      setTaskCountByFlagId(
        Object.fromEntries((rows ?? []).map((row) => [row.flag_id, Number(row.total)])),
      );
    } catch (error) {
      console.error("Erro ao contar tarefas por flag:", error);
    }
  }, []);

  useEffect(() => {
    // The initial request owns its loading state inside fetchFlags.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchFlags();
  }, [fetchFlags]);

  function normalizeInput(input: TaskFlagInput) {
    const name = input.name.trim();
    if (!name) toast.error("Informe um nome para a flag");
    return name ? { name, color: input.color } : null;
  }

  function showSaveError(error: unknown, title: string) {
    toast.error(isUniqueViolation(error) ? "Já existe uma flag com esse nome" : title, {
      description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
    });
  }

  async function createFlag(input: TaskFlagInput) {
    const normalized = normalizeInput(input);
    if (!normalized) return false;

    setIsSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      await post("task_flags", { ...normalized, user_id: userId });
      await fetchFlags();
      toast.success("Flag criada");
      return true;
    } catch (error) {
      showSaveError(error, "Não foi possível criar a flag");
      console.error("Erro ao criar flag de tarefa:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateFlag(id: string, input: TaskFlagInput) {
    const normalized = normalizeInput(input);
    if (!normalized) return false;

    setIsSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      await patch("task_flags", normalized, { id: id, user_id: userId });
      setFlags((current) =>
        current
          .map((flag) => (flag.id === id ? { ...flag, ...normalized } : flag))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      );
      toast.success("Flag atualizada");
      return true;
    } catch (error) {
      showSaveError(error, "Não foi possível atualizar a flag");
      console.error("Erro ao atualizar flag de tarefa:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteFlag(id: string) {
    setIsSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      await remove("task_flags", { id: id, user_id: userId });
      setFlags((current) => current.filter((flag) => flag.id !== id));
      // Os vínculos caem em cascade no banco; as tarefas recarregam pra não sobrar flag fantasma.
      notifyAppDataChanged("tasks");
      toast.success("Flag excluída");
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir a flag", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao excluir flag de tarefa:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    flags,
    taskCountByFlagId,
    isLoading,
    isSaving,
    refreshFlagCounts: fetchFlagCounts,
    createFlag,
    updateFlag,
    deleteFlag,
  };
}
