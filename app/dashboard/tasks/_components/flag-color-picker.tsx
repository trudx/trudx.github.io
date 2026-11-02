"use client";

//* Libraries Imports
import { Check } from "lucide-react";

//* Constants Imports
import { TASK_FLAG_COLORS } from "@/hooks/use-task-flags";

//* Utils Imports
import { cn } from "@/lib/utils";

type FlagColorPickerProps = {
  value: string;
  disabled?: boolean;
  onChange: (color: string) => void;
};

export function FlagColorPicker({ value, disabled, onChange }: FlagColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="Cor da flag" className="flex flex-wrap gap-1.5">
      {TASK_FLAG_COLORS.map((color) => {
        const isSelected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Cor ${color}`}
            disabled={disabled}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-white transition-transform hover:scale-110 disabled:opacity-50",
              isSelected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          >
            {isSelected && <Check className="size-4" />}
          </button>
        );
      })}
    </div>
  );
}
