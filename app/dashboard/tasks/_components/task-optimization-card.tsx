"use client";

//* Components Imports
import Skeleton from "@/components/ui/skeleton";

//* Libraries Imports
import { Gauge } from "lucide-react";

//* Types Imports
import type { TaskRecord } from "@/hooks/use-tasks";

//* Utils Imports
import { getAverageTimeUsage } from "@/lib/task-time-efficiency";
import { cn } from "@/lib/utils";

type TaskOptimizationCardProps = {
  tasks: TaskRecord[];
  secondsByTaskId: Record<string, number>;
  isLoading: boolean;
};

export function TaskOptimizationCard({
  tasks,
  secondsByTaskId,
  isLoading,
}: TaskOptimizationCardProps) {
  const result = getAverageTimeUsage(
    tasks.map((task) => ({
      estimatedMinutes: task.average_duration_minutes,
      loggedSeconds: secondsByTaskId[task.id] ?? 0,
    })),
  );
  const isFaster = (result?.optimizationPercent ?? 0) >= 0;

  return (
    <div className="flex min-h-48 flex-col justify-between rounded-2xl border border-border bg-muted/60 p-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border">
          <Gauge className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Otimização</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Previsto x executado</p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Carregando otimização">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : result ? (
        <div className="mt-4">
          <p
            className={cn(
              "text-2xl font-bold tracking-tight tabular-nums",
              isFaster
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300",
            )}
          >
            {isFaster ? "-" : "+"}
            {Math.abs(Math.round(result.optimizationPercent))}%
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Em média você gasta {Math.round(result.averageUsagePercent)}% do tempo previsto
            {isFaster ? " (mais rápido que o estimado)" : " (acima do estimado)"} ·{" "}
            {result.sampleSize} {result.sampleSize === 1 ? "tarefa" : "tarefas"} com tempo
            registrado.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Registre o tempo de tarefas com tempo previsto para ver quanto você otimiza.
        </p>
      )}
    </div>
  );
}
