"use client";

//* Components Imports
import Button from "@/components/ui/button";

import { KanbanColumn } from "./kanban-column";

//* Libraries Imports
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

//* Hooks Imports
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";

//* Types Imports
import type { TaskColumnRecord } from "@/hooks/use-task-columns";
import type { TaskFlagRecord } from "@/hooks/use-task-flags";
import type { TaskColumnCount, TaskColumnPage } from "@/lib/task-board";
import type { TaskCardHandlers } from "./draggable-task-card";

//* Utils Imports
import { EMPTY_COLUMN_PAGE } from "@/lib/task-board";
import { getStageByColumnId } from "@/lib/task-stages";
import { cn } from "@/lib/utils";

export type KanbanBoardProps = TaskCardHandlers & {
  columns: TaskColumnRecord[];
  pages: Record<string, TaskColumnPage>;
  counts: Record<string, TaskColumnCount>;
  isLoadingCounts: boolean;
  clientNameById: Record<string, string>;
  flagById: Record<string, TaskFlagRecord>;
  onLoadMore: (columnId: string) => void;
};

export function KanbanBoard({
  columns,
  pages,
  counts,
  isLoadingCounts,
  clientNameById,
  flagById,
  timer,
  onEdit,
  onDelete,
  onQuickEdit,
  onLoadMore,
}: KanbanBoardProps) {
  const { ref, canScrollLeft, canScrollRight, scrollByColumn, updateEdges } =
    useHorizontalScroll<HTMLDivElement>();

  const stageByColumnId = getStageByColumnId(columns);

  // Criar/remover coluna muda a largura do trilho sem disparar scroll nem resize do container.
  useEffect(() => {
    updateEdges();
  }, [columns.length, updateEdges]);

  return (
    <SortableContext items={columns.map((column) => column.id)} strategy={rectSortingStrategy}>
      <div className="group/board relative h-full min-h-0">
        <div
          ref={ref}
          className={cn(
            // Mobile: trilho com rolagem lateral. Desktop: as colunas encolhem pra caber todas, então
            // não sobra rolagem (setas e esmaecimentos só aparecem no celular).
            "flex h-full min-h-0",
            "gap-3",
            "overflow-x-auto overscroll-x-contain md:overflow-x-hidden",
            "pb-3 md:pb-0",
            "trudx-scroll-x",

            // Snap só no mobile — no desktop ele brigaria com trackpad/shift+scroll.
            "snap-x snap-mandatory md:snap-none",
          )}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              page={pages[column.id] ?? EMPTY_COLUMN_PAGE}
              taskCount={isLoadingCounts ? undefined : (counts[column.id]?.filtered ?? 0)}
              stage={stageByColumnId[column.id]}
              clientNameById={clientNameById}
              flagById={flagById}
              timer={timer}
              onEdit={onEdit}
              onDelete={onDelete}
              onQuickEdit={onQuickEdit}
              onLoadMore={onLoadMore}
            />
          ))}
        </div>

        {/* Esmaecimento nas bordas: avisa que há colunas escondidas daquele lado. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Setas só no desktop; no celular o deslizar com snap já resolve. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Ver colunas anteriores"
          onClick={() => scrollByColumn(-1)}
          className={cn(
            "absolute top-1/2 left-1 hidden -translate-y-1/2 bg-background/95 shadow-sm backdrop-blur transition-opacity md:inline-flex",
            canScrollLeft
              ? "opacity-70 group-hover/board:opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Ver próximas colunas"
          onClick={() => scrollByColumn(1)}
          className={cn(
            "absolute top-1/2 right-1 hidden -translate-y-1/2 bg-background/95 shadow-sm backdrop-blur transition-opacity md:inline-flex",
            canScrollRight
              ? "opacity-70 group-hover/board:opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <ChevronRight />
        </Button>
      </div>
    </SortableContext>
  );
}
