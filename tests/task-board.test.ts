//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Types Imports
import type { TaskRecord } from "../hooks/use-tasks.ts";
import type { TaskBoardState } from "../lib/task-board.ts";

//* Utils Imports
import { appendColumnPage, applyTaskChange } from "../lib/task-board.ts";
import { EMPTY_TASK_FILTERS } from "../lib/task-filters.ts";

function task(id: string, columnId: string, createdAt: string, extra: Partial<TaskRecord> = {}) {
  return {
    id,
    user_id: "user",
    title: `Tarefa ${id}`,
    description: null,
    priority: "medium",
    column_id: columnId,
    cliente_id: null,
    average_duration_minutes: 30,
    due_date: "2026-11-02",
    created_at: createdAt,
    updated_at: createdAt,
    flag_ids: [],
    ...extra,
  } satisfies TaskRecord;
}

const a3 = task("a3", "A", "2026-11-03T10:00:00+00:00");
const a2 = task("a2", "A", "2026-11-02T10:00:00+00:00");
const a1 = task("a1", "A", "2026-11-01T10:00:00+00:00");

function boardWith(pages: TaskBoardState["pages"], counts: TaskBoardState["counts"]) {
  return { pages, counts };
}

describe("quadro de tarefas paginado", () => {
  it("não repete card ao juntar uma página nova", () => {
    const page = { tasks: [a3, a2], hasMore: true, isLoading: true };
    const next = appendColumnPage(page, [a2, a1], 2);
    assert.deepEqual(
      next.tasks.map((item) => item.id),
      ["a3", "a2", "a1"],
    );
    assert.equal(next.hasMore, true);
    assert.equal(appendColumnPage(page, [a1], 2).hasMore, false);
  });

  it("move o card e ajusta os contadores das duas colunas", () => {
    const state = boardWith(
      {
        A: { tasks: [a3, a2], hasMore: false, isLoading: false },
        B: { tasks: [], hasMore: false, isLoading: false },
      },
      { A: { total: 2, filtered: 2 } },
    );
    const moved = { ...a2, column_id: "B" };
    const next = applyTaskChange(state, a2, moved, EMPTY_TASK_FILTERS);
    assert.deepEqual(
      next.pages.A.tasks.map((item) => item.id),
      ["a3"],
    );
    assert.deepEqual(
      next.pages.B.tasks.map((item) => item.id),
      ["a2"],
    );
    assert.deepEqual(next.counts, { A: { total: 1, filtered: 1 }, B: { total: 1, filtered: 1 } });
  });

  it("não insere card mais antigo que o trecho carregado de uma coluna com mais páginas", () => {
    const state = boardWith(
      {
        B: {
          tasks: [task("b9", "B", "2026-11-05T10:00:00+00:00")],
          hasMore: true,
          isLoading: false,
        },
      },
      {},
    );
    const next = applyTaskChange(state, null, { ...a1, column_id: "B" }, EMPTY_TASK_FILTERS);
    assert.equal(next.pages.B.tasks.length, 1);
    assert.deepEqual(next.counts.B, { total: 1, filtered: 1 });
  });

  it("card que deixa de passar no filtro sai da lista e só do contador filtrado", () => {
    const filters = { ...EMPTY_TASK_FILTERS, priorities: ["medium" as const] };
    const state = boardWith(
      { A: { tasks: [a3], hasMore: false, isLoading: false } },
      { A: { total: 1, filtered: 1 } },
    );
    const next = applyTaskChange(state, a3, { ...a3, priority: "high" }, filters);
    assert.equal(next.pages.A.tasks.length, 0);
    assert.deepEqual(next.counts.A, { total: 1, filtered: 0 });
  });
});
