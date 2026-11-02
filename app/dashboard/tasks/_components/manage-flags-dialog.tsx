"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";

import { FlagColorPicker } from "./flag-color-picker";
import { TaskFlagRow } from "./task-flag-row";

//* Libraries Imports
import { Plus } from "lucide-react";
import { useState } from "react";

//* Types Imports
import type { TaskFlagInput, TaskFlagRecord } from "@/hooks/use-task-flags";

//* Constants Imports
import { MAX_FLAGS_PER_TASK, TASK_FLAG_COLORS } from "@/hooks/use-task-flags";

type ManageFlagsDialogProps = {
  open: boolean;
  flags: TaskFlagRecord[];
  taskCountByFlagId: Record<string, number>;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: TaskFlagInput) => Promise<boolean>;
  onUpdate: (id: string, input: TaskFlagInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

export function ManageFlagsDialog({
  open,
  flags,
  taskCountByFlagId,
  isSaving,
  onOpenChange,
  onCreate,
  onUpdate,
  onDelete,
}: ManageFlagsDialogProps) {
  const [newFlag, setNewFlag] = useState<TaskFlagInput>({ name: "", color: TASK_FLAG_COLORS[0] });

  async function addFlag() {
    if (await onCreate(newFlag)) setNewFlag((current) => ({ ...current, name: "" }));
  }

  return (
    <Dialog.DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            Gerenciar flags
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Etiquetas que aparecem no topo dos cards e servem de filtro. Cada tarefa aceita até{" "}
            {MAX_FLAGS_PER_TASK} flags.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newFlag.name}
              maxLength={40}
              onChange={(event) =>
                setNewFlag((current) => ({ ...current, name: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") void addFlag();
              }}
              placeholder="Nome da nova flag"
              aria-label="Nome da nova flag"
            />
            <Button
              type="button"
              disabled={isSaving || !newFlag.name.trim()}
              onClick={() => void addFlag()}
            >
              <Plus />
              Adicionar
            </Button>
          </div>
          <FlagColorPicker
            value={newFlag.color}
            disabled={isSaving}
            onChange={(color) => setNewFlag((current) => ({ ...current, color }))}
          />
        </div>
        {flags.length ? (
          <ul className="space-y-2">
            {flags.map((flag) => (
              <TaskFlagRow
                key={flag.id}
                flag={flag}
                taskCount={taskCountByFlagId[flag.id] ?? 0}
                isSaving={isSaving}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma flag cadastrada.
          </p>
        )}
        <Dialog.DialogFooter className="mt-4 border-t-0 bg-transparent p-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
