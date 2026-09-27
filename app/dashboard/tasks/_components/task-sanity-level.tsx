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
      badgeClassName: "border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
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

  return (
    <div className="flex min-h-48 flex-col justify-between rounded-2xl border border-border bg-muted/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border">
            <HeartPulse className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Nível de sanidade</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {period === "daily"
                ? title
                : `${title} · ${referenceDays} ${referenceDays === 1 ? "dia útil" : "dias úteis"}`}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${level.badgeClassName}`}
        >
          {level.label}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-label="Carregando horas trabalhadas">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {seconds > 0 ? formatDuration(seconds) : "0h"}
            </p>
            <p className="mt-1 min-h-7 text-[10px] leading-relaxed text-muted-foreground">
              {level.detail}
            </p>
          </div>

          <div
            className="mt-3"
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
              <span aria-hidden="true" className="absolute inset-y-0 left-[60%] z-10 w-px bg-background/90" />
              <span aria-hidden="true" className="absolute inset-y-0 left-[80%] z-10 w-px bg-background/90" />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 text-[9px] leading-tight text-muted-foreground">
            <span>
              <strong className="block font-semibold text-foreground">{optimalHours}h</strong>
              Ótimo · 6h/dia
            </span>
            <span className="text-center">
              <strong className="block font-semibold text-foreground">{standardHours}h</strong>
              Padrão · 8h/dia
            </span>
            <span className="text-right">
              <strong className="block font-semibold text-foreground">{surplusHours}h</strong>
              Superávit · 10h/dia
            </span>
          </div>
        </>
      )}
    </div>
  );
}
