"use client";

//* Libraries Imports
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

//* Utils Imports
import { cn } from "@/lib/utils";

type FinanceiroSecaoProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Seção recolhível: mantém o dashboard leve — quem só quer o resumo recolhe o resto. */
export function FinanceiroSecao({
  title,
  description,
  defaultOpen = true,
  children,
}: FinanceiroSecaoProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={panelId} hidden={!open} className="space-y-4">
        {children}
      </div>
    </section>
  );
}
