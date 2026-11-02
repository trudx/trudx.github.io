"use client";

//* Libraries Imports
import { Check } from "lucide-react";

//* Types Imports
import type { TaskFlagRecord } from "@/hooks/use-task-flags";

//* Constants Imports
import { MAX_FLAGS_PER_TASK } from "@/hooks/use-task-flags";

//* Utils Imports
import { cn } from "@/lib/utils";

type TaskFlagPickerProps = {
  flags: TaskFlagRecord[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

/** Liga/desliga flags da tarefa. Chegando ao limite, as não marcadas travam. */
export function TaskFlagPicker({ flags, selected, onChange }: TaskFlagPickerProps) {
  const isFull = selected.length >= MAX_FLAGS_PER_TASK;

  if (!flags.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma flag cadastrada. Crie em &quot;Flags&quot;, no topo da página.
      </p>
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => {
        const isSelected = selected.includes(flag.id);
        return (
          <button
            key={flag.id}
            type="button"
            aria-pressed={isSelected}
            disabled={!isSelected && isFull}
            onClick={() =>
              onChange(
                isSelected ? selected.filter((id) => id !== flag.id) : [...selected, flag.id],
              )
            }
            style={
              isSelected ? { backgroundColor: flag.color, borderColor: flag.color } : undefined
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              isSelected ? "text-white" : "bg-background text-foreground hover:bg-muted",
            )}
          >
            {isSelected ? (
              <Check className="size-3.5" />
            ) : (
              <span style={{ backgroundColor: flag.color }} className="size-2.5 rounded-full" />
            )}
            {flag.name}
          </button>
        );
      })}
    </div>
  );
}
