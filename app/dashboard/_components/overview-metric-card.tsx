"use client";

//* Components Imports
import Skeleton from "@/components/ui/skeleton";

//* Libraries Imports
import { ChevronRight } from "lucide-react";

//* Types Imports
import type { LucideIcon } from "lucide-react";

//* Utils Imports
import { cn } from "@/lib/utils";

type OverviewMetricCardProps = {
  label: string;
  /** Valor já formatado. Quando `null`, o card mostra `emptyLabel` e não abre nada. */
  value: string | null;
  emptyLabel: string;
  hint?: string;
  icon?: LucideIcon;
  isLoading: boolean;
  valueClassName?: string;
  /**
   * `hero`: vidro escuro, para ficar sobre a ilustração do topo — legível em qualquer período do
   * dia e nos dois temas. `default`: card comum da página.
   */
  variant?: "default" | "hero";
  onOpen?: () => void;
};

export function OverviewMetricCard({
  label,
  value,
  emptyLabel,
  hint,
  icon: Icon,
  isLoading,
  valueClassName,
  variant = "default",
  onOpen,
}: OverviewMetricCardProps) {
  const isHero = variant === "hero";
  const isEmpty = value === null;
  const isClickable = Boolean(onOpen) && !isEmpty && !isLoading;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn("text-sm font-medium", isHero ? "text-zinc-300" : "text-muted-foreground")}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              isHero ? "bg-white/10 text-white" : "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <Skeleton className={cn("h-9 w-32", isHero && "bg-white/10")} />
        ) : (
          <p
            className={cn(
              "text-3xl font-semibold tracking-[-0.03em] tabular-nums",
              isEmpty
                ? cn("text-lg font-normal", isHero ? "text-zinc-400" : "text-muted-foreground")
                : valueClassName,
            )}
          >
            {isEmpty ? emptyLabel : value}
          </p>
        )}

        {hint && !isLoading && !isEmpty && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs leading-relaxed",
              isHero ? "text-zinc-400" : "text-muted-foreground",
            )}
          >
            {hint}
            {isClickable && (
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            )}
          </p>
        )}
      </div>
    </>
  );

  const className = cn(
    "relative flex flex-col justify-between gap-6 rounded-xl p-5 text-left",
    isHero
      ? "min-h-40 border border-white/10 bg-zinc-950/85 text-white shadow-xl backdrop-blur-md"
      : "border bg-card",
  );

  if (!isClickable) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        className,
        "group transition-all duration-300",
        isHero
          ? "hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl"
          : "hover:bg-accent/40",
      )}
    >
      {content}
    </button>
  );
}
