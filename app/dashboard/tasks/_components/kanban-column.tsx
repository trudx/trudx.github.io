"use client";

//* Components Imports
import Button from "@/components/ui/button";

import { DraggableTaskCard } from "./draggable-task-card";
import { TaskCardSkeleton } from "./task-card-skeleton";
import { toZoomedTranslate, useTasksZoomContext } from "./tasks-zoom-context";

//* Libraries Imports
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

//* Types Imports
import type { TaskColumnRecord } from "@/hooks/use-task-columns";
import type { TaskRecord } from "@/hooks/use-tasks";
import type { TaskCardHandlers } from "./draggable-task-card";

//* Utils Imports
import { cn } from "@/lib/utils";

type KanbanColumnProps = TaskCardHandlers & {
  column: TaskColumnRecord;
  tasks: TaskRecord[];
  clientNameById: Record<string, string>;
  isLoading: boolean;
};

export function KanbanColumn({
  column,
  tasks,
  clientNameById,
  timer,
  isLoading,
  onEdit,
  onDelete,
  onQuickEdit,
}: KanbanColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: column.id,
      data: {
        type: "column",
      },
    });

  const scale = useTasksZoomContext();
  const style = {
    transform: toZoomedTranslate(transform, scale),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: column.color ?? "var(--foreground)",
      }}
      className={cn(
        // Mobile: coluna tipo slide, ocupando quase a tela toda.
        // Desktop: as colunas dividem a largura inteira do quadro, sem rolagem lateral.
        "w-[min(85vw,20rem)] shrink-0 snap-start",
        "md:w-auto md:min-w-0 md:flex-1 md:shrink",

        // Estrutura principal da coluna.
        "flex min-h-[24rem] flex-col overflow-hidden",
        "rounded-xl border border-l-4 bg-muted/45",
        "p-2.5",

        // No desktop a coluna deve respeitar exatamente a altura disponibilizada pelo pai.
        "md:h-full md:min-h-0",

        "transition-[transform,background-color,border-color]",

        isOver && "border-foreground/35 bg-muted",
        isDragging && "z-10 opacity-60 shadow-xl",
      )}
      aria-label={`${column.name}: ${tasks.length} tarefas`}
    >
      {/* Header fica fora da área de scroll */}
      <header className="mb-2.5 flex shrink-0 items-center justify-between gap-2 pl-1">
        <h2 className="min-w-0 truncate text-base font-bold">{column.name}</h2>

        <div className="flex shrink-0 items-center gap-0.5">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-1.5 text-sm font-semibold text-muted-foreground">
            {isLoading ? "—" : tasks.length}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={`Arrastar coluna ${column.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </Button>
        </div>
      </header>

      {/* Somente essa área rola */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2",
          "overflow-y-auto",
          "[scrollbar-width:none]",
          "[&::-webkit-scrollbar]:hidden",
        )}
      >
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <TaskCardSkeleton key={index} />)
        ) : tasks.length ? (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              clientName={task.cliente_id ? clientNameById[task.cliente_id] : undefined}
              timer={timer}
              onEdit={onEdit}
              onDelete={onDelete}
              onQuickEdit={onQuickEdit}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa nesta coluna.
          </div>
        )}
      </div>
    </section>
  );
}
