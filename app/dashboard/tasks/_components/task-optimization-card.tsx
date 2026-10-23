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

  const tooltip = result
    ? `Em média você gasta ${Math.round(result.averageUsagePercent)}% do tempo previsto · ${result.sampleSize} ${result.sampleSize === 1 ? "tarefa" : "tarefas"} com tempo registrado.`
    : "Registre o tempo de tarefas com tempo previsto para ver quanto você otimiza.";

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/60 p-4"
      title={tooltip}
    >
      <p className="flex min-w-0 items-center gap-1.5 text-base font-medium text-muted-foreground">
        <Gauge className="size-4 shrink-0" />
        <span className="truncate">Otimização</span>
      </p>

      {isLoading ? (
        <div className="space-y-2" aria-label="Carregando otimização">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : result ? (
        <>
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
          <p className="text-sm text-muted-foreground">
            {isFaster ? "Mais rápido que o previsto" : "Acima do previsto"}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sem tempo registrado ainda.</p>
      )}
    </div>
  );
}
