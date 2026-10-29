"use client";

//* Components Imports
import Skeleton from "@/components/ui/skeleton";

//* Libraries Imports
import { HeartPulse } from "lucide-react";

//* Utils Imports
import { formatDuration } from "@/lib/format-duration";

const DAILY_HOUR_LIMITS = {
  optimal: 6,
  standard: 8,
  surplus: 10,
} as const;

type Period = "daily" | "weekly" | "monthly";

type Level = {
  label: string;
  detail: string;
  badgeClassName: string;
  fillClassName: string;
};

function getLevel(seconds: number, referenceDays: number, period: Period): Level {
  if (seconds === 0) {
    return {
      label: "Sem registros",
      detail: "Inicie o cronômetro para acompanhar seu ritmo.",
      badgeClassName: "border-border bg-background text-muted-foreground",
      fillClassName: "bg-muted-foreground/50",
    };
  }

  const days = Math.max(referenceDays, 1);
  const hoursPerDay = seconds / 3600 / days;
  const detail =
    period === "daily"
      ? "Faixas do dia: ótimo até 6h, padrão até 8h."
      : referenceDays === 0
        ? "Sem dias úteis até agora; referência diária de 6, 8 e 10h."
        : `Média por dia útil · ${referenceDays} ${referenceDays === 1 ? "dia" : "dias"} considerados.`;

  if (hoursPerDay <= DAILY_HOUR_LIMITS.optimal) {
    return {
      label: "Ótimo",
      detail,
      badgeClassName:
        "border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
      fillClassName: "bg-emerald-600",
    };
  }

  if (hoursPerDay <= DAILY_HOUR_LIMITS.standard) {
    return {
      label: "Padrão",
      detail,
      badgeClassName: "border-sky-600/20 bg-sky-600/10 text-sky-800 dark:text-sky-300",
      fillClassName: "bg-sky-600",
    };
  }

  if (hoursPerDay <= DAILY_HOUR_LIMITS.surplus) {
    return {
      label: "Superávit",
      detail: `${detail} Reserve tempo para pausas.`,
      badgeClassName: "border-amber-600/20 bg-amber-600/10 text-amber-800 dark:text-amber-300",
      fillClassName: "bg-amber-600",
    };
  }

  return {
    label: "Insano",
    detail: `${detail} Hora de descansar.`,
    badgeClassName: "border-rose-600/20 bg-rose-600/10 text-rose-800 dark:text-rose-300",
    fillClassName: "bg-rose-600",
  };
}

type TaskSanityLevelProps = {
  period: Period;
  title: string;
  seconds: number;
  referenceDays: number;
  isLoading: boolean;
};

export function TaskSanityLevel({
  period,
  title,
  seconds,
  referenceDays,
  isLoading,
}: TaskSanityLevelProps) {
  const level = getLevel(seconds, referenceDays, period);
  const days = Math.max(referenceDays, 1);
  const optimalHours = DAILY_HOUR_LIMITS.optimal * days;
  const standardHours = DAILY_HOUR_LIMITS.standard * days;
  const surplusHours = DAILY_HOUR_LIMITS.surplus * days;
  const hours = seconds / 3600;
  const progress = Math.min(100, (hours / surplusHours) * 100);

  // Os detalhes (média por dia útil, faixas) vão pro tooltip: no card só fica o que se lê de relance.
  const tooltip = `${level.detail} Faixas: ótimo até ${optimalHours}h, padrão até ${standardHours}h, superávit até ${surplusHours}h.`;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/60 p-4"
      title={tooltip}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-base font-medium text-muted-foreground">
          <HeartPulse className="size-4 shrink-0" />
          <span className="truncate">{title}</span>
        </p>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-sm font-semibold ${level.badgeClassName}`}
        >
          {level.label}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-label="Carregando horas trabalhadas">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-2 w-full" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-display font-bold text-foreground tabular-nums">
            {seconds > 0 ? formatDuration(seconds) : "0h"}
          </p>

          <div
            role="progressbar"
            aria-label={`Horas trabalhadas: ${title.toLowerCase()}`}
            aria-valuemin={0}
            aria-valuemax={surplusHours}
            aria-valuenow={Number(Math.min(hours, surplusHours).toFixed(2))}
            aria-valuetext={`${formatDuration(seconds)} · nível ${level.label}`}
          >
            <div className="relative h-2.5 overflow-hidden rounded-full bg-background ring-1 ring-border/70">
              <div aria-hidden="true" className="absolute inset-0 flex opacity-60">
                <span className="w-3/5 bg-emerald-500/20" />
                <span className="w-1/5 bg-amber-500/20" />
                <span className="w-1/5 bg-rose-500/20" />
              </div>
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${level.fillClassName}`}
                style={{ width: `${progress}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-[60%] z-10 w-px bg-background/90"
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-[80%] z-10 w-px bg-background/90"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
