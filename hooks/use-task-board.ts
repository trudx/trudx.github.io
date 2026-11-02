"use client";

//* Libraries Imports
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useAppDataRefresh } from "@/hooks/use-app-data-refresh";

//* Services Imports
import { patch, post, remove, rpc } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { TaskInput, TaskQuickPatch, TaskRecord, TaskRow } from "@/hooks/use-tasks";
import type { TaskBoardState, TaskColumnCount } from "@/lib/task-board";
import type { TaskFilterValue } from "@/lib/task-filters";

//* Constants Imports
import { TASK_SELECT } from "@/hooks/use-tasks";

//* Utils Imports
import { syncTaskFlags, toTaskRecord } from "@/hooks/use-tasks";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  EMPTY_COLUMN_PAGE,
  TASK_BOARD_PAGE_SIZE,
  appendColumnPage,
  applyTaskChange,
} from "@/lib/task-board";

type TaskColumnCountRow = TaskColumnCount & { column_id: string };

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Quadro kanban paginado: cada coluna carrega 20 cards por vez e o resto vem conforme o scroll.
 * Os filtros rodam no banco (`task_board_page`); os contadores vêm de uma consulta separada
 * (`task_board_counts`), então refletem todas as tarefas e não só as carregadas.
 *
 * Criar, editar, mover e excluir atualizam o estado local (`applyTaskChange`) em vez de recarregar
 * as colunas, pra não perder as páginas que o usuário já rolou.
 */
export function useTaskBoard(columnIds: string[], filters: TaskFilterValue) {
  const [board, setBoard] = useState<TaskBoardState>({ pages: {}, counts: {} });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(filters.searchText);

  // Digitar na busca não dispara uma consulta por coluna a cada tecla.
  useEffect(() => {
    const timeout = setTimeout(() => setSearchText(filters.searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [filters.searchText]);

  const appliedFilters = useMemo(() => ({ ...filters, searchText }), [filters, searchText]);

  const boardRef = useRef(board);
  const filtersRef = useRef(appliedFilters);
  const columnIdsRef = useRef(columnIds);
  // Cada reset ganha uma geração nova; resposta de geração antiga (filtro trocado no meio) é ignorada.
  const generationRef = useRef(0);
  const requestedColumnsRef = useRef(new Set<string>());

  useEffect(() => {
    boardRef.current = board;
    filtersRef.current = appliedFilters;
    columnIdsRef.current = columnIds;
  });

  const loadPage = useCallback(async (columnId: string, generation: number) => {
    const lastLoaded = boardRef.current.pages[columnId]?.tasks.at(-1);
    try {
      const received = await rpc<TaskRecord[]>("task_board_page", {
        p_column_id: columnId,
        p_filters: filtersRef.current,
        p_limit: TASK_BOARD_PAGE_SIZE,
        p_before_created_at: lastLoaded?.created_at ?? null,
        p_before_id: lastLoaded?.id ?? null,
      });
      if (generation !== generationRef.current) return;
      setBoard((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [columnId]: appendColumnPage(
            current.pages[columnId] ?? EMPTY_COLUMN_PAGE,
            received ?? [],
            TASK_BOARD_PAGE_SIZE,
          ),
        },
      }));
    } catch (error) {
      if (generation !== generationRef.current) return;
      // `hasMore: false` pra o scroll não ficar repetindo a mesma consulta que falhou.
      setBoard((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [columnId]: {
            ...(current.pages[columnId] ?? EMPTY_COLUMN_PAGE),
            hasMore: false,
            isLoading: false,
          },
        },
      }));
      toast.error("Não foi possível carregar as tarefas", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao carregar página de tarefas:", error);
    }
  }, []);

  const loadCounts = useCallback(async (generation: number) => {
    try {
      const rows = await rpc<TaskColumnCountRow[]>("task_board_counts", {
        p_filters: filtersRef.current,
      });
      if (generation !== generationRef.current) return;
      setBoard((current) => ({
        ...current,
        counts: Object.fromEntries(
          (rows ?? []).map((row) => [
            row.column_id,
            { total: Number(row.total), filtered: Number(row.filtered) },
          ]),
        ),
      }));
    } catch (error) {
      console.error("Erro ao contar tarefas por coluna:", error);
    } finally {
      if (generation === generationRef.current) setIsLoadingCounts(false);
    }
  }, []);

  const resetBoard = useCallback(() => {
    const generation = ++generationRef.current;
    const ids = columnIdsRef.current;
    requestedColumnsRef.current = new Set(ids);
    setIsLoadingCounts(true);
    setBoard({
      pages: Object.fromEntries(ids.map((id) => [id, EMPTY_COLUMN_PAGE])),
      counts: boardRef.current.counts,
    });
    // O boardRef só atualiza no próximo render; sem isto a 1ª página usaria o cursor antigo.
    boardRef.current = { pages: {}, counts: boardRef.current.counts };
    for (const id of ids) void loadPage(id, generation);
    void loadCounts(generation);
  }, [loadCounts, loadPage]);

  const refreshFromEvent = useCallback(async () => resetBoard(), [resetBoard]);
  useAppDataRefresh(refreshFromEvent, ["tasks"]);

  useEffect(() => {
    filtersRef.current = appliedFilters;
    // Filtro novo = quadro novo: as páginas carregadas não valem mais.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetBoard();
  }, [appliedFilters, resetBoard]);

  const columnIdsKey = columnIds.join(",");
  useEffect(() => {
    // Coluna criada depois do primeiro carregamento ainda não tem página.
    const generation = generationRef.current;
    const missingIds = columnIdsKey
      .split(",")
      .filter((id) => id && !requestedColumnsRef.current.has(id));
    if (!missingIds.length) return;
    for (const id of missingIds) requestedColumnsRef.current.add(id);
    setBoard((current) => ({
      ...current,
      pages: {
        ...current.pages,
        ...Object.fromEntries(missingIds.map((id) => [id, EMPTY_COLUMN_PAGE])),
      },
    }));
    for (const id of missingIds) void loadPage(id, generation);
  }, [columnIdsKey, loadPage]);

  const loadMore = useCallback(
    (columnId: string) => {
      const page = boardRef.current.pages[columnId];
      if (!page || page.isLoading || !page.hasMore) return;
      const loadingPage = { ...page, isLoading: true };
      boardRef.current = {
        ...boardRef.current,
        pages: { ...boardRef.current.pages, [columnId]: loadingPage },
      };
      setBoard((current) => ({
        ...current,
        pages: { ...current.pages, [columnId]: { ...current.pages[columnId], isLoading: true } },
      }));
      void loadPage(columnId, generationRef.current);
    },
    [loadPage],
  );

  function findTask(id: string) {
    for (const page of Object.values(boardRef.current.pages)) {
      const task = page.tasks.find((current) => current.id === id);
      if (task) return task;
    }
    return null;
  }

  function applyChange(previous: TaskRecord | null, next: TaskRecord | null) {
    setBoard((current) => applyTaskChange(current, previous, next, filtersRef.current));
  }

  async function createTask(input: TaskInput, flagIds: string[] = []) {
    setIsSaving(true);

    try {
      const userId = await getAuthenticatedUserId();
      const [created] = await post<TaskRow>(
        "tasks",
        { ...input, user_id: userId },
        { select: TASK_SELECT },
      );
      if (created) {
        await syncTaskFlags(created.id, userId, [], flagIds);
        applyChange(null, { ...toTaskRecord(created), flag_ids: flagIds });
      }
      toast.success("Tarefa cadastrada");
      return true;
    } catch (error) {
      toast.error("Não foi possível cadastrar a tarefa", {
        description: getApiErrorMessage(error, "Confira os dados e tente novamente."),
      });
      console.error("Erro ao cadastrar tarefa:", error);
      // A tarefa pode ter sido gravada e só os vínculos de flag falharem.
      resetBoard();
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTask(id: string, input: TaskInput, flagIds?: string[]) {
    const previous = findTask(id);
    setIsSaving(true);

    try {
      const userId = await getAuthenticatedUserId();
      const [updated] = await patch<TaskRow>(
        "tasks",
        input,
        { id: id, user_id: userId },
        { select: TASK_SELECT },
      );
      if (flagIds) await syncTaskFlags(id, userId, previous?.flag_ids ?? [], flagIds);
      if (updated) {
        const next = toTaskRecord(updated);
        applyChange(previous, flagIds ? { ...next, flag_ids: flagIds } : next);
      }
      toast.success("Tarefa atualizada");
      return true;
    } catch (error) {
      toast.error("Não foi possível atualizar a tarefa", {
        description: getApiErrorMessage(error, "Confira os dados e tente novamente."),
      });
      console.error("Erro ao atualizar tarefa:", error);
      resetBoard();
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  /** Alteração otimista: aplica na hora e desfaz se o banco recusar. */
  async function patchOptimistically(
    id: string,
    changes: Partial<TaskRecord>,
    errorTitle: string,
    logMessage: string,
  ) {
    const previous = findTask(id);
    if (!previous) return false;
    const next = { ...previous, ...changes };
    applyChange(previous, next);

    try {
      const userId = await getAuthenticatedUserId();
      await patch("tasks", changes, { id: id, user_id: userId });
      return true;
    } catch (error) {
      applyChange(next, previous);
      toast.error(errorTitle, {
        description: getApiErrorMessage(error, "A alteração foi desfeita. Tente novamente."),
      });
      console.error(logMessage, error);
      return false;
    }
  }

  async function updateTaskColumn(id: string, columnId: string) {
    if (findTask(id)?.column_id === columnId) return true;
    return patchOptimistically(
      id,
      { column_id: columnId },
      "Não foi possível mover a tarefa",
      "Erro ao atualizar coluna da tarefa:",
    );
  }

  /** Atualiza prioridade/cliente direto do card (Sheet de edição rápida). */
  async function quickUpdateTask(id: string, changes: TaskQuickPatch) {
    const task = findTask(id);
    if (!task) return false;
    if (
      Object.entries(changes).every(([key, value]) => task[key as keyof TaskQuickPatch] === value)
    )
      return true;
    return patchOptimistically(
      id,
      changes,
      "Não foi possível atualizar a tarefa",
      "Erro ao atualizar tarefa pelo card:",
    );
  }

  async function deleteTask(id: string) {
    const previous = findTask(id);
    setDeletingTaskId(id);

    try {
      const userId = await getAuthenticatedUserId();
      await remove("tasks", { id: id, user_id: userId });
      applyChange(previous, null);
      toast.success("Tarefa excluída");
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir a tarefa", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao excluir tarefa:", error);
      return false;
    } finally {
      setDeletingTaskId(null);
    }
  }

  return {
    pages: board.pages,
    counts: board.counts,
    isLoadingCounts,
    isSaving,
    deletingTaskId,
    loadMore,
    createTask,
    updateTask,
    updateTaskColumn,
    quickUpdateTask,
    deleteTask,
    refreshBoard: resetBoard,
  };
}
