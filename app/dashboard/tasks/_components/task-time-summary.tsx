"use client";

import { TaskSanityLevel } from "./task-sanity-level";

//* Libraries Imports
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

//* Types Imports
import type { TaskTimeTotais } from "@/hooks/use-task-timer";

function subscribeToLocalDate(onChange: () => void) {
  let timeoutId = 0;

  function scheduleNextDay() {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timeoutId = window.setTimeout(() => {
      onChange();
      scheduleNextDay();
    }, nextDay.getTime() - now.getTime() + 100);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") onChange();
  }

  scheduleNextDay();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.clearTimeout(timeoutId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

function getLocalDateSnapshot() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getServerDateSnapshot() {
  return "";
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getElapsedWeekdaysInWeek(date: Date | null) {
  if (!date || date.getDay() === 0) return 0;
  return Math.min(date.getDay(), 5);
}

function getElapsedWeekdaysInMonth(date: Date | null) {
  if (!date) return 0;

  let weekdays = 0;
  for (let day = 1; day <= date.getDate(); day += 1) {
    const weekday = new Date(date.getFullYear(), date.getMonth(), day).getDay();
    if (weekday > 0 && weekday < 6) weekdays += 1;
  }
  return weekdays;
}

type TaskTimeSummaryProps = {
  totais: TaskTimeTotais;
  /** Momento em que `totais` era exato; o extra ao vivo é contado a partir daqui. */
  totaisAtualizadosEm: number;
  isRunning: boolean;
  isLoading: boolean;
  onRefresh: () => void;
};

/**
 * Totais de tempo trabalhado, que continuam correndo enquanto houver um cronômetro ativo.
 *
 * O tick vive aqui dentro (e não no `useTaskTimer`, que é montado na página) pra que só estes três
 * cards re-renderizem por segundo — não o quadro inteiro, que estaria brigando com o dnd-kit no
 * meio de um arrasto.
 */
export function TaskTimeSummary({
  totais,
  totaisAtualizadosEm,
  isRunning,
  isLoading,
  onRefresh,
}: TaskTimeSummaryProps) {
  const localDateSnapshot = useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDateSnapshot,
    getServerDateSnapshot,
  );
  const localDate = parseLocalDate(localDateSnapshot);
  const previousDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!localDateSnapshot) return;
    if (previousDateRef.current === null) {
      previousDateRef.current = localDateSnapshot;
      return;
    }

    if (previousDateRef.current !== localDateSnapshot) {
      previousDateRef.current = localDateSnapshot;
      onRefresh();
    }
  }, [localDateSnapshot, onRefresh]);

  // O baseline anda junto do valor pra que, quando ele muda (cronômetro novo, ou totais relidos do
  // servidor), a sobra do ciclo anterior não apareça no intervalo entre o render e o primeiro tick.
  const [tick, setTick] = useState({ baseline: totaisAtualizadosEm, segundos: 0 });

  useEffect(() => {
    if (!isRunning) return;

    // Cada tick recalcula a partir do baseline em vez de incrementar, então o número continua
    // certo mesmo depois de o navegador estrangular o timer numa aba em segundo plano.
    const interval = setInterval(
      () =>
        setTick({
          baseline: totaisAtualizadosEm,
          segundos: Math.max(0, Math.floor((Date.now() - totaisAtualizadosEm) / 1000)),
        }),
      1000,
    );
    return () => clearInterval(interval);
  }, [isRunning, totaisAtualizadosEm]);

  const extraSegundos = isRunning && tick.baseline === totaisAtualizadosEm ? tick.segundos : 0;

  const cards = [
    { period: "daily", title: "Hoje", seconds: totais.hojeSegundos, referenceDays: 1 },
    {
      period: "weekly",
      title: "Esta semana",
      seconds: totais.semanaSegundos,
      referenceDays: getElapsedWeekdaysInWeek(localDate),
    },
    {
      period: "monthly",
      title: "Este mês",
      seconds: totais.mesSegundos,
      referenceDays: getElapsedWeekdaysInMonth(localDate),
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <TaskSanityLevel
          key={card.period}
          period={card.period}
          title={card.title}
          seconds={card.seconds + extraSegundos}
          referenceDays={card.referenceDays}
          isLoading={isLoading || !localDateSnapshot}
        />
      ))}
    </div>
  );
}
