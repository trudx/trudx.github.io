//* Types Imports
import type { TaskRecord } from "@/hooks/use-tasks";
import type { TaskFilterValue } from "@/lib/task-filters";

//* Utils Imports
import { filterTasks } from "./task-filters.ts";

export const TASK_BOARD_PAGE_SIZE = 20;

/** Cards já carregados de uma coluna. `hasMore` diz se ainda há página no banco. */
export type TaskColumnPage = {
  tasks: TaskRecord[];
  hasMore: boolean;
  isLoading: boolean;
};

/** `total` ignora filtros (decide se a coluna pode ser excluída); `filtered` vai no cabeçalho. */
export type TaskColumnCount = { total: number; filtered: number };

export type TaskBoardState = {
  pages: Record<string, TaskColumnPage>;
  counts: Record<string, TaskColumnCount>;
};

export const EMPTY_COLUMN_PAGE: TaskColumnPage = { tasks: [], hasMore: true, isLoading: true };

/**
 * Mesma ordem do banco: mais recentes primeiro, `id` desempata. As datas vêm todas do PostgREST
 * no mesmo formato ISO, então comparar como texto respeita até os microssegundos.
 */
export function compareTaskOrder(a: TaskRecord, b: TaskRecord) {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function matchesTaskFilters(task: TaskRecord, filters: TaskFilterValue) {
  return filterTasks([task], filters).length > 0;
}

/** Junta uma página nova sem repetir card (um card movido pode chegar de novo pela paginação). */
export function appendColumnPage(page: TaskColumnPage, received: TaskRecord[], pageSize: number) {
  const knownIds = new Set(page.tasks.map((task) => task.id));
  return {
    tasks: [...page.tasks, ...received.filter((task) => !knownIds.has(task.id))],
    hasMore: received.length === pageSize,
    isLoading: false,
  };
}

function addCount(
  counts: Record<string, TaskColumnCount>,
  columnId: string,
  delta: TaskColumnCount,
) {
  const current = counts[columnId] ?? { total: 0, filtered: 0 };
  return {
    ...counts,
    [columnId]: {
      total: Math.max(0, current.total + delta.total),
      filtered: Math.max(0, current.filtered + delta.filtered),
    },
  };
}

/**
 * Aplica uma mudança de tarefa ao quadro sem recarregar: `previous` sai de onde estava e `next`
 * entra na coluna dele (se passar nos filtros). Criar = só `next`; excluir = só `previous`.
 *
 * O card só entra se cair dentro do trecho já carregado da coluna; se for mais antigo que o último
 * card carregado, ele aparece quando a paginação chegar lá — senão haveria buraco na lista.
 */
export function applyTaskChange(
  state: TaskBoardState,
  previous: TaskRecord | null,
  next: TaskRecord | null,
  filters: TaskFilterValue,
): TaskBoardState {
  let { pages, counts } = state;

  if (previous) {
    const page = pages[previous.column_id];
    if (page)
      pages = {
        ...pages,
        [previous.column_id]: {
          ...page,
          tasks: page.tasks.filter((task) => task.id !== previous.id),
        },
      };
    counts = addCount(counts, previous.column_id, {
      total: -1,
      filtered: matchesTaskFilters(previous, filters) ? -1 : 0,
    });
  }

  if (next) {
    const matches = matchesTaskFilters(next, filters);
    const page = pages[next.column_id];
    if (page && matches) {
      const lastLoaded = page.tasks.at(-1);
      const isInLoadedRange =
        !page.hasMore || !lastLoaded || compareTaskOrder(next, lastLoaded) < 0;
      if (isInLoadedRange)
        pages = {
          ...pages,
          [next.column_id]: {
            ...page,
            tasks: [...page.tasks.filter((task) => task.id !== next.id), next].sort(
              compareTaskOrder,
            ),
          },
        };
    }
    counts = addCount(counts, next.column_id, { total: 1, filtered: matches ? 1 : 0 });
  }

  return { pages, counts };
}
