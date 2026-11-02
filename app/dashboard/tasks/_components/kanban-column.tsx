"use client";

//* Components Imports
import Button from "@/components/ui/button";

import { DraggableTaskCard } from "./draggable-task-card";
import { TaskCardSkeleton } from "./task-card-skeleton";
import { toZoomedTranslate, useTasksZoomContext } from "./tasks-zoom-context";

//* Libraries Imports
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

//* Types Imports
import type { TaskColumnRecord } from "@/hooks/use-task-columns";
import type { TaskFlagRecord } from "@/hooks/use-task-flags";
import type { TaskColumnPage } from "@/lib/task-board";
import type { TaskStage } from "@/lib/task-stages";
import type { TaskCardHandlers } from "./draggable-task-card";

//* Utils Imports
import { cn } from "@/lib/utils";

type KanbanColumnProps = TaskCardHandlers & {
  column: TaskColumnRecord;
  page: TaskColumnPage;
  /** Total da coluna (com filtros), vindo da contagem separada. `undefined` = carregando. */
  taskCount: number | undefined;
  stage: TaskStage;
  clientNameById: Record<string, string>;
  flagById: Record<string, TaskFlagRecord>;
  onLoadMore: (columnId: string) => void;
};

export function KanbanColumn({
  column,
  page,
  taskCount,
  stage,
  clientNameById,
  flagById,
  timer,
  onEdit,
  onDelete,
  onQuickEdit,
  onLoadMore,
}: KanbanColumnProps) {
  const { tasks, hasMore, isLoading } = page;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = isLoading && tasks.length === 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: column.id,
      data: {
        type: "column",
      },
    });

  // Scroll infinito: quando o fim da lista chega perto da área visível, pede a próxima página. O
  // observer é recriado a cada página recebida; se a lista ainda não encheu a coluna, o sentinela
  // continua visível e a próxima página já é pedida na sequência.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore(column.id);
      },
      { root: scrollAreaRef.current, rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [column.id, hasMore, isLoading, tasks.length, onLoadMore]);

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
      aria-label={`${column.name}: ${taskCount ?? tasks.length} tarefas`}
    >
      {/* Header fica fora da área de scroll */}
      <header className="mb-2.5 flex shrink-0 items-center justify-between gap-2 pl-1">
        <h2 className="min-w-0 truncate text-base font-bold">{column.name}</h2>

        <div className="flex shrink-0 items-center gap-0.5">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-1.5 text-sm font-semibold text-muted-foreground">
            {taskCount ?? "—"}
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
        ref={scrollAreaRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2",
          "overflow-y-auto",
          "[scrollbar-width:none]",
          "[&::-webkit-scrollbar]:hidden",
        )}
      >
        {isFirstLoad ? (
          Array.from({ length: 3 }, (_, index) => <TaskCardSkeleton key={index} />)
        ) : tasks.length ? (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              clientName={task.cliente_id ? clientNameById[task.cliente_id] : undefined}
              flags={task.flag_ids.flatMap((id) => flagById[id] ?? [])}
              stage={stage}
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
        {!isFirstLoad && hasMore && (
          <div
            ref={sentinelRef}
            className="flex shrink-0 justify-center py-3 text-muted-foreground"
            aria-live="polite"
          >
            {isLoading && (
              <Loader2 className="size-5 animate-spin" aria-label="Carregando mais tarefas" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
