"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";

import { SortableColumn } from "./sortable-column";

//* Libraries Imports
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useState } from "react";

//* Types Imports
import type { DragEndEvent } from "@dnd-kit/core";
import type { TaskColumnRecord, TaskColumnStage } from "@/hooks/use-task-columns";

//* Constants Imports
import { taskColumnStageLabels } from "@/lib/task-stages";

type ManageColumnsDialogProps = {
  open: boolean;
  columns: TaskColumnRecord[];
  taskCountByColumnId: Record<string, number>;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (orderedIds: string[]) => Promise<boolean>;
  onSetStage: (stage: TaskColumnStage, columnId: string | null) => Promise<boolean>;
};

const NO_STAGE_COLUMN = "none";
const stageDescriptions: Record<TaskColumnStage, string> = {
  pending: "Ela e as anteriores ficam neutras: ainda na fila.",
  done: "Ela e as posteriores ficam em verde apagado: concluídas ou canceladas.",
};

export function ManageColumnsDialog({
  open,
  columns,
  taskCountByColumnId,
  isSaving,
  onOpenChange,
  onCreate,
  onRename,
  onDelete,
  onReorder,
  onSetStage,
}: ManageColumnsDialogProps) {
  const [newColumnName, setNewColumnName] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function addColumn() {
    if (await onCreate(newColumnName)) setNewColumnName("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((column) => column.id === active.id);
    const newIndex = columns.findIndex((column) => column.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0)
      void onReorder(arrayMove(columns, oldIndex, newIndex).map((column) => column.id));
  }

  return (
    <Dialog.DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            Gerenciar colunas
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Organize as etapas do seu fluxo. Colunas com tarefas precisam ser esvaziadas antes de
            serem excluídas.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        <div className="flex gap-2">
          <Input
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addColumn();
            }}
            placeholder="Nome da nova coluna"
            aria-label="Nome da nova coluna"
          />
          <Button
            type="button"
            disabled={isSaving || !newColumnName.trim()}
            onClick={() => void addColumn()}
          >
            <Plus />
            Adicionar
          </Button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={columns.map((column) => column.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {columns.map((column) => (
                <SortableColumn
                  key={column.id}
                  column={column}
                  taskCount={taskCountByColumnId[column.id] ?? 0}
                  isSaving={isSaving}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          {(["pending", "done"] as TaskColumnStage[]).map((stage) => {
            const selectedColumn = columns.find((column) => column.stage === stage);
            return (
              <div key={stage} className="space-y-2">
                <Label>Coluna de {taskColumnStageLabels[stage].toLowerCase()}</Label>
                <Select.SelectRoot
                  value={selectedColumn?.id ?? NO_STAGE_COLUMN}
                  onValueChange={(value) => {
                    if (value) void onSetStage(stage, value === NO_STAGE_COLUMN ? null : value);
                  }}
                >
                  <Select.SelectTrigger
                    className="h-10 w-full bg-background"
                    disabled={isSaving || columns.length === 0}
                  >
                    <Select.SelectValue>{selectedColumn?.name ?? "Nenhuma"}</Select.SelectValue>
                  </Select.SelectTrigger>
                  <Select.SelectContent>
                    <Select.SelectItem value={NO_STAGE_COLUMN}>Nenhuma</Select.SelectItem>
                    {columns.map((column) => (
                      <Select.SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </Select.SelectItem>
                    ))}
                  </Select.SelectContent>
                </Select.SelectRoot>
                <p className="text-xs text-muted-foreground">{stageDescriptions[stage]}</p>
              </div>
            );
          })}
        </div>
        <Dialog.DialogFooter className="mt-4 border-t-0 bg-transparent p-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
