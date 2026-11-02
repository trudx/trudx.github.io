"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

import { FlagColorPicker } from "./flag-color-picker";

//* Libraries Imports
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

//* Types Imports
import type { TaskFlagInput, TaskFlagRecord } from "@/hooks/use-task-flags";

type TaskFlagRowProps = {
  flag: TaskFlagRecord;
  taskCount: number;
  isSaving: boolean;
  onUpdate: (id: string, input: TaskFlagInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

export function TaskFlagRow({ flag, taskCount, isSaving, onUpdate, onDelete }: TaskFlagRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<TaskFlagInput>({ name: flag.name, color: flag.color });

  function cancelEdit() {
    setDraft({ name: flag.name, color: flag.color });
    setIsEditing(false);
  }

  async function saveFlag() {
    if (await onUpdate(flag.id, draft)) setIsEditing(false);
  }

  if (isEditing)
    return (
      <li className="space-y-2 rounded-lg border bg-background p-2">
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft.name}
            maxLength={40}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveFlag();
              if (event.key === "Escape") cancelEdit();
            }}
            className="h-8"
            aria-label={`Novo nome de ${flag.name}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isSaving}
            onClick={() => void saveFlag()}
            aria-label="Salvar flag"
          >
            <Check />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isSaving}
            onClick={cancelEdit}
            aria-label="Cancelar edição"
          >
            <X />
          </Button>
        </div>
        <FlagColorPicker
          value={draft.color}
          disabled={isSaving}
          onChange={(color) => setDraft((current) => ({ ...current, color }))}
        />
      </li>
    );

  return (
    <li className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <div className="min-w-0 flex-1">
        <span
          style={{ backgroundColor: flag.color }}
          className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-sm font-bold text-white"
        >
          {flag.name}
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {taskCount ? `${taskCount} ${taskCount === 1 ? "tarefa" : "tarefas"}` : "Sem tarefas"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isSaving}
        onClick={() => setIsEditing(true)}
        aria-label={`Editar ${flag.name}`}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isSaving}
        title={taskCount ? "A flag sai das tarefas junto" : "Excluir flag"}
        onClick={() => void onDelete(flag.id)}
        aria-label={`Excluir ${flag.name}`}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
