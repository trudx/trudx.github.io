"use client";

//* Components Imports
import Button from "@/components/ui/button";

import {
  DeleteTaskDialog,
  KanbanBoard,
  ManageColumnsDialog,
  ManageFlagsDialog,
  TaskCard,
  TaskFilters,
  TaskFormDialog,
  TaskQuickEditSheet,
  TaskOptimizationCard,
  TaskTimeSummary,
  TasksZoomContext,
} from "./_components";

//* Libraries Imports
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Flag, Plus, SlidersHorizontal } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

//* Hooks Imports
import { useClients } from "@/hooks/use-clients";
import { useTaskColumns } from "@/hooks/use-task-columns";
import { useTaskBoard } from "@/hooks/use-task-board";
import { useTaskEstimates } from "@/hooks/use-task-estimates";
import { useTaskFlags } from "@/hooks/use-task-flags";
import { useTaskTimer } from "@/hooks/use-task-timer";
import { useTasksZoomScale } from "@/hooks/use-tasks-zoom";

//* Types Imports
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { TaskRecord } from "@/hooks/use-tasks";
import type { TaskFilterValue } from "@/lib/task-filters";

//* Utils Imports
import { EMPTY_TASK_FILTERS } from "@/lib/task-filters";
import { getStageByColumnId } from "@/lib/task-stages";

export default function TasksPage() {
  const { clients, selectableClients } = useClients();
  const zoomScale = useTasksZoomScale();
  // O overlay de arraste vai por portal para o body; portal só existe no cliente.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const {
    runningTaskId,
    runningStartedAt,
    secondsByTaskId,
    totais,
    totaisAtualizadosEm,
    isLoading: isLoadingTimer,
    isSaving: isSavingTimer,
    startTimer,
    stopTimer,
    discardTimer,
    setTaskSeconds,
    refreshTimer,
  } = useTaskTimer();
  const {
    columns,
    isLoading: isLoadingColumns,
    isSaving: isSavingColumns,
    createColumn,
    renameColumn,
    deleteColumn,
    reorderColumns,
    setColumnStage,
  } = useTaskColumns();
  const {
    flags,
    taskCountByFlagId,
    isSaving: isSavingFlags,
    refreshFlagCounts,
    createFlag,
    updateFlag,
    deleteFlag,
  } = useTaskFlags();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskRecord | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [quickEditTaskId, setQuickEditTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilterValue>(EMPTY_TASK_FILTERS);
  const [isManagingColumns, setIsManagingColumns] = useState(false);
  const [isManagingFlags, setIsManagingFlags] = useState(false);
  const {
    pages,
    counts,
    isLoadingCounts,
    isSaving,
    deletingTaskId,
    loadMore,
    createTask,
    updateTask,
    updateTaskColumn,
    quickUpdateTask,
    deleteTask,
  } = useTaskBoard(
    columns.map((column) => column.id),
    filters,
  );
  const { estimates, isLoading: isLoadingEstimates } = useTaskEstimates();
  // Mouse e toque separados de propósito: um PointerSensor único atenderia os dois pelo mesmo
  // caminho, e o `delay` que o toque precisa viraria uma espera de 220ms antes de todo arrasto no
  // desktop. Assim o mouse mantém o comportamento antigo e só o dedo precisa segurar — e a escolha
  // é por tipo de entrada, não por largura de tela (notebook com touchscreen ganha os dois).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function openCreateDialog() {
    setEditingTask(null);
    setIsFormOpen(true);
  }
  function openEditDialog(task: TaskRecord) {
    setEditingTask(task);
    setIsFormOpen(true);
  }
  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "task")
      setActiveTask(event.active.data.current.task as TaskRecord);
  }
  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    const type = event.active.data.current?.type;
    setActiveTask(null);
    if (typeof overId !== "string") return;
    if (type === "column") {
      const oldIndex = columns.findIndex((column) => column.id === event.active.id);
      const newIndex = columns.findIndex((column) => column.id === overId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex)
        void reorderColumns(arrayMove(columns, oldIndex, newIndex).map((column) => column.id));
      return;
    }
    if (type === "task" && columns.some((column) => column.id === overId))
      void updateTaskColumn(String(event.active.id), overId);
  }
  // Usa o `total` (sem filtro) de propósito: ele decide se uma coluna pode ser excluída, e um
  // filtro ativo não pode mentir sobre isso. O cabeçalho das colunas mostra o `filtered`.
  const taskCountByColumnId = Object.fromEntries(
    Object.entries(counts).map(([columnId, count]) => [columnId, count.total]),
  );
  const loadedTasks = Object.values(pages).flatMap((page) => page.tasks);
  // O tempo previsto de cards já carregados pode ter sido editado agora; vale sobre a consulta leve.
  const loadedById = new Map(loadedTasks.map((task) => [task.id, task]));
  const taskEstimates = estimates.map((estimate) => loadedById.get(estimate.id) ?? estimate);
  const clientNameById = Object.fromEntries(clients.map((client) => [client.id, client.name]));
  const flagById = Object.fromEntries(flags.map((flag) => [flag.id, flag]));
  const stageByColumnId = getStageByColumnId(columns);
  const timerProps = {
    runningTaskId,
    runningStartedAt,
    secondsByTaskId,
    isSaving: isSavingTimer,
    onStart: (taskId: string) => void startTimer(taskId),
    onStop: () => void stopTimer(),
  };

  // A tarefa excluída leva junto suas entradas de tempo (cascade). Se a excluída for a que estava
  // rodando, sem isto sobraria um cronômetro fantasma nos totais.
  async function handleDeleteTask(id: string) {
    const success = await deleteTask(id);
    if (success) void refreshTimer();
    return success;
  }
  // Lido da lista (e não guardado em estado) pro Sheet refletir cada alteração salva na hora.
  const quickEditTask = (quickEditTaskId && loadedById.get(quickEditTaskId)) || null;

  return (
    <TasksZoomContext value={zoomScale}>
      {/* Ocupa a altura da tela menos o respiro vertical do <main> (py-8); no lg a sidebar sai do
          topo, então dá pra casar exatamente e a página não rola — só as colunas. */}
      <div className="md:h-[87vh] md:min-h-0 md:overflow-hidden lg:h-[calc(100dvh-4rem)]">
        <section
          style={{ zoom: zoomScale }}
          className="flex flex-col gap-5 md:h-full md:min-h-0 md:overflow-hidden"
        >
          <div className="flex shrink-0 flex-col justify-between gap-5 border-b pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="trudx-kicker mb-1.5 text-muted-foreground">Organização</p>
              <h1 className="text-xl font-display font-bold text-foreground">Tarefas</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="hidden md:inline">
                  Arraste as tarefas entre as colunas para acompanhar cada etapa. Use a alça no
                  cabeçalho para reordenar as colunas.
                </span>
                <span className="md:hidden">
                  Deslize para o lado para ver as outras colunas. Segure um card por um instante
                  para arrastá-lo — ou use o botão de mover no próprio card.
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4"
                onClick={() => {
                  void refreshFlagCounts();
                  setIsManagingFlags(true);
                }}
              >
                <Flag />
                Flags
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4"
                onClick={() => setIsManagingColumns(true)}
              >
                <SlidersHorizontal />
                Gerenciar colunas
              </Button>
              <Button
                type="button"
                className="h-11 px-3 text-xs font-medium"
                disabled={isLoadingColumns || columns.length === 0}
                onClick={openCreateDialog}
              >
                <Plus />
                Nova tarefa
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Resumo em uma faixa só: 4 cards lado a lado no desktop, 2 por linha nas telas menores. */}
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TaskTimeSummary
                totais={totais}
                totaisAtualizadosEm={totaisAtualizadosEm}
                isRunning={runningTaskId !== null}
                isLoading={isLoadingTimer}
                onRefresh={refreshTimer}
              />
              <TaskOptimizationCard
                tasks={taskEstimates}
                secondsByTaskId={secondsByTaskId}
                isLoading={isLoadingTimer || isLoadingEstimates}
              />
            </div>
            <TaskFilters value={filters} clients={clients} flags={flags} onChange={setFilters} />
            <div className="min-h-0 flex-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <KanbanBoard
                  columns={columns}
                  pages={pages}
                  counts={counts}
                  isLoadingCounts={isLoadingCounts || isLoadingColumns}
                  clientNameById={clientNameById}
                  flagById={flagById}
                  timer={timerProps}
                  onEdit={openEditDialog}
                  onDelete={setDeletingTask}
                  onQuickEdit={(task) => setQuickEditTaskId(task.id)}
                  onLoadMore={loadMore}
                />
                {isClient
                  ? createPortal(
                      <DragOverlay>
                        {activeTask ? (
                          <div
                            style={{ zoom: zoomScale }}
                            className="w-[min(22rem,calc(100vw-2rem))] rotate-1 shadow-xl"
                          >
                            <TaskCard
                              task={activeTask}
                              clientName={
                                activeTask.cliente_id
                                  ? clientNameById[activeTask.cliente_id]
                                  : undefined
                              }
                              flags={activeTask.flag_ids.flatMap((id) => flagById[id] ?? [])}
                              stage={stageByColumnId[activeTask.column_id]}
                            />
                          </div>
                        ) : null}
                      </DragOverlay>,
                      document.body,
                    )
                  : null}
              </DndContext>
            </div>
            {quickEditTask && (
              <TaskQuickEditSheet
                task={quickEditTask}
                clients={selectableClients}
                columns={columns}
                timer={{
                  ...timerProps,
                  onDiscard: () => void discardTimer(),
                  onSetSeconds: setTaskSeconds,
                }}
                onOpenChange={(open) => {
                  if (!open) setQuickEditTaskId(null);
                }}
                onPatch={quickUpdateTask}
                onMoveToColumn={updateTaskColumn}
              />
            )}
            <TaskFormDialog
              key={`${editingTask?.id ?? "new"}-${isFormOpen}`}
              open={isFormOpen}
              task={editingTask}
              columns={columns}
              clients={selectableClients}
              flags={flags}
              isSaving={isSaving}
              onOpenChange={setIsFormOpen}
              onSubmit={(input, flagIds) =>
                editingTask
                  ? updateTask(editingTask.id, input, flagIds)
                  : createTask(input, flagIds)
              }
            />
            <ManageColumnsDialog
              open={isManagingColumns}
              columns={columns}
              taskCountByColumnId={taskCountByColumnId}
              isSaving={isSavingColumns}
              onOpenChange={setIsManagingColumns}
              onCreate={createColumn}
              onRename={renameColumn}
              onDelete={deleteColumn}
              onReorder={reorderColumns}
              onSetStage={setColumnStage}
            />
            <ManageFlagsDialog
              open={isManagingFlags}
              flags={flags}
              taskCountByFlagId={taskCountByFlagId}
              isSaving={isSavingFlags}
              onOpenChange={setIsManagingFlags}
              onCreate={createFlag}
              onUpdate={updateFlag}
              onDelete={deleteFlag}
            />
            <DeleteTaskDialog
              open={Boolean(deletingTask)}
              taskTitle={deletingTask?.title ?? ""}
              loggedSeconds={deletingTask ? (secondsByTaskId[deletingTask.id] ?? 0) : 0}
              isDeleting={Boolean(deletingTaskId)}
              onOpenChange={(open) => {
                if (!open) setDeletingTask(null);
              }}
              onConfirm={() =>
                deletingTask ? handleDeleteTask(deletingTask.id) : Promise.resolve(false)
              }
            />
          </div>
        </section>
      </div>
    </TasksZoomContext>
  );
}
