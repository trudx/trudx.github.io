//* Utils Imports
import { getTimeUsagePercent } from "@/lib/task-time-efficiency";
import { cn } from "@/lib/utils";

type TaskTimeProgressProps = {
  estimatedMinutes: number;
  loggedSeconds: number;
  className?: string;
};

/** Barra de tempo real x previsto. Passou de 100% = estourou o previsto. */
export function TaskTimeProgress({
  estimatedMinutes,
  loggedSeconds,
  className,
}: TaskTimeProgressProps) {
  const percent = getTimeUsagePercent({ estimatedMinutes, loggedSeconds });
  if (percent === null || loggedSeconds <= 0) return null;

  const rounded = Math.round(percent);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label="Tempo real em relação ao previsto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(rounded, 100)}
        aria-valuetext={`${rounded}% do tempo previsto`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-current/20"
      >
        <div
          className={cn("h-full rounded-full bg-current", percent > 100 && "opacity-100")}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums">
        {rounded}%{percent > 100 && " ⚠"}
      </span>
    </div>
  );
}
