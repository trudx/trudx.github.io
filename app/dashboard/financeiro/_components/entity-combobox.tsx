"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Command from "@/components/ui/command";
import Popover from "@/components/ui/popover";

//* Libraries Imports
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

//* Utils Imports
import { cn } from "@/lib/utils";

export type EntityComboboxOption = { value: string; label: string };

type EntityComboboxProps = {
  value: string | null;
  options: EntityComboboxOption[];
  emptyLabel: string;
  searchPlaceholder: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
};

/** Seleção única com busca (Popover + Command); `null` representa "sem seleção". */
export function EntityCombobox({
  value,
  options,
  emptyLabel,
  searchPlaceholder,
  disabled,
  onChange,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function handleSelect(next: string | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover.PopoverRoot open={open} onOpenChange={setOpen}>
      <Popover.PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between bg-background font-normal"
          />
        }
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? emptyLabel}
        </span>
        <ChevronsUpDown className="opacity-50" />
      </Popover.PopoverTrigger>

      <Popover.PopoverContent align="start" className="w-64 p-0">
        <Command.CommandRoot>
          <Command.CommandInput placeholder={searchPlaceholder} />
          <Command.CommandList>
            <Command.CommandEmpty>Nada encontrado.</Command.CommandEmpty>
            <Command.CommandGroup>
              <Command.CommandItem value={emptyLabel} onSelect={() => handleSelect(null)}>
                <Check className={cn("size-4", value === null ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{emptyLabel}</span>
              </Command.CommandItem>
              {options.map((option) => (
                <Command.CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option.label}</span>
                </Command.CommandItem>
              ))}
            </Command.CommandGroup>
          </Command.CommandList>
        </Command.CommandRoot>
      </Popover.PopoverContent>
    </Popover.PopoverRoot>
  );
}
