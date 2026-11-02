"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";

import { TaskTimeProgress } from "./task-time-progress";
import { TaskTimerDisplay } from "./task-timer-display";

//* Libraries Imports
import {
  ArrowRightLeft,
  CalendarDays,
  Clock3,
  Pencil,
  Play,
  Square,
  Timer,
  Trash2,
  User,
} from "lucide-react";

//* Types Imports
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { MouseEvent } from "react";
import type { TaskFlagRecord } from "@/hooks/use-task-flags";
import type { TaskPriority, TaskRecord } from "@/hooks/use-tasks";
import type { TaskStage } from "@/lib/task-stages";

//* Utils Imports
import { formatDateShort } from "@/lib/format-date";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

/** Agrupado num prop só porque atravessa 4 níveis até chegar no card. */
export type TaskTimerProps = {
  runningTaskId: string | null;
  runningStartedAt: string | null;
  secondsByTaskId: Record<string, number>;
  isSaving: boolean;
  onStart: (taskId: string) => void;
  onStop: () => void;
};

type TaskCardProps = {
  task: TaskRecord;
  clientName?: string;
  flags?: TaskFlagRecord[];
  stage?: TaskStage;
  isDragging?: boolean;
  draggableAttributes?: DraggableAttributes;
  draggableListeners?: DraggableSyntheticListeners;
  timer?: TaskTimerProps;
  onEdit?: (task: TaskRecord) => void;
  onDelete?: (task: TaskRecord) => void;
  onQuickEdit?: (task: TaskRecord) => void;
};

const priorityLabels: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Urgente",
};
const priorityCardStyles: Record<TaskPriority, string> = {
  low: "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-950 dark:bg-zinc-950 dark:text-white",
  medium:
    "border-amber-400 bg-amber-400 text-amber-950 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
  high: "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500 dark:text-white",
};

// Executando: o card assume o azul e ignora etapa e prioridade, pra dar pra ver de longe o que está
// rodando. Concluído (coluna de conclusão em diante) fica num verde bem apagado, que recua atrás das
// cores cheias de quem está em produção. Pendente (coluna de pendência pra trás) fica neutro, "ainda
// na fila", e a prioridade continua visível só no badge.
const runningCardStyle =
  "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500 dark:text-white";
const doneCardStyle =
  "border-emerald-200 bg-emerald-50 text-zinc-600 dark:border-emerald-900/70 dark:bg-emerald-950 dark:text-zinc-400";
const pendingCardStyle = "border-border bg-card text-card-foreground";
const doneBadgeStyle = "border-emerald-700/25 bg-transparent text-muted-foreground";

/** Paleta dos detalhes (badge, textos secundários, divisória) conforme o fundo do card. */
type CardTone = "onDark" | "onAmber" | "onSurface";

const priorityTones: Record<TaskPriority, CardTone> = {
  low: "onDark",
  medium: "onAmber",
  high: "onDark",
};
const toneBadgeStyles: Record<Exclude<CardTone, "onSurface">, string> = {
  onDark: "border-white/40 bg-white/15 text-white",
  onAmber: "border-amber-950/30 bg-amber-950/10 text-amber-950",
};
const toneMutedTextStyles: Record<CardTone, string> = {
  onDark: "text-white/80",
  onAmber: "text-amber-950/75",
  onSurface: "text-muted-foreground",
};
const toneDividerStyles: Record<CardTone, string> = {
  onDark: "border-white/25",
  onAmber: "border-amber-950/20",
  onSurface: "border-border",
};

function getCardStyle(task: TaskRecord, stage: TaskStage, isRunning: boolean) {
  if (isRunning) return runningCardStyle;
  if (stage === "done") return doneCardStyle;
  if (stage === "pending") return pendingCardStyle;
  return priorityCardStyles[task.priority];
}

function getCardTone(task: TaskRecord, stage: TaskStage, isRunning: boolean): CardTone {
  if (isRunning) return "onDark";
  if (stage === "pending" || stage === "done") return "onSurface";
  return priorityTones[task.priority];
}

export function TaskCard({
  task,
  clientName,
  flags = [],
  stage = "progress",
  isDragging,
  draggableAttributes,
  draggableListeners,
  timer,
  onEdit,
  onDelete,
  onQuickEdit,
}: TaskCardProps) {
  const isRunning = timer?.runningTaskId === task.id;
  const loggedSeconds = timer?.secondsByTaskId[task.id] ?? 0;
  const tone = getCardTone(task, stage, isRunning);
  const isDone = stage === "done" && !isRunning;
  // No pendente o badge usa a cor cheia da prioridade, que aí é o único sinal dela; no concluído a
  // prioridade já não importa e o badge também se apaga.
  const badgeStyle = isDone
    ? doneBadgeStyle
    : tone === "onSurface"
      ? priorityCardStyles[task.priority]
      : toneBadgeStyles[tone];

  return (
    <article
      {...draggableAttributes}
      {...draggableListeners}
      onClick={(event) => {
        if (!onEdit || (event.target as HTMLElement).closest("button, a, input, textarea, select"))
          return;
        onEdit(task);
      }}
      aria-label={onEdit ? `Tarefa ${task.title}. Clique para editar.` : undefined}
      className={cn(
        "group relative rounded-lg border p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        getCardStyle(task, stage, isRunning),
        // Sem `touch-none`: os listeners cobrem o card inteiro, então ele diria ao navegador
        // "nunca role a partir daqui" e a página travaria no celular. Com o TouchSensor por
        // atraso, o navegador precisa mesmo ser dono do gesto até a ativação.
        draggableListeners && "cursor-grab touch-manipulation active:cursor-grabbing",
        onEdit && "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      {flags.length > 0 && (
        <ul
          className={cn("mb-1.5 flex flex-wrap gap-1", isDone && "opacity-60")}
          aria-label="Flags"
        >
          {flags.map((flag) => (
            <li
              key={flag.id}
              style={{ backgroundColor: flag.color }}
              className="max-w-full truncate rounded-full px-2 py-0.5 text-sm leading-tight font-bold text-white ring-1 ring-white/40"
            >
              {flag.name}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-w-0 text-lg font-semibold leading-snug">{task.title}</h3>
        <Badge
          variant="outline"
          {...(onQuickEdit
            ? {
                render: <button type="button" />,
                onClick: (event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  onQuickEdit(task);
                },
                "aria-label": `Alterar prioridade e cliente de ${task.title}`,
                title: "Alterar prioridade e cliente",
              }
            : {})}
          className={cn(
            "shrink-0 text-sm",
            badgeStyle,
            onQuickEdit && "cursor-pointer hover:brightness-110",
          )}
        >
          {priorityLabels[task.priority]}
        </Badge>
      </div>

      {task.description && (
        <p className={cn("mt-1 line-clamp-1 text-base", toneMutedTextStyles[tone])}>
          {task.description}
        </p>
      )}

      <div
        className={cn(
          "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-medium",
          toneMutedTextStyles[tone],
        )}
      >
        <span className="inline-flex items-center gap-1.5" title="Entrega">
          <CalendarDays className="size-4" />
          {formatDateShort(task.due_date)}
        </span>
        <span className="inline-flex items-center gap-1.5" title="Tempo estimado">
          <Clock3 className="size-4" />
          {task.average_duration_minutes} min
        </span>
        {isRunning && timer?.runningStartedAt ? (
          <span className="inline-flex items-center gap-1.5 font-bold" title="Em execução">
            <span className="size-2 animate-pulse rounded-full bg-current" />
            <TaskTimerDisplay key={timer.runningStartedAt} startedAt={timer.runningStartedAt} />
          </span>
        ) : (
          loggedSeconds > 0 && (
            <span className="inline-flex items-center gap-1.5 font-bold" title="Tempo real">
              <Timer className="size-4" />
              {formatDuration(loggedSeconds)}
            </span>
          )
        )}
        {clientName && (
          <span className="inline-flex min-w-0 items-center gap-1.5" title="Cliente">
            <User className="size-4 shrink-0" />
            <span className="truncate">{clientName}</span>
          </span>
        )}
      </div>

      {timer && loggedSeconds > 0 && (
        <TaskTimeProgress
          estimatedMinutes={task.average_duration_minutes}
          loggedSeconds={loggedSeconds}
          className={cn("mt-2 [&>span]:text-sm", toneMutedTextStyles[tone])}
        />
      )}

      {(onEdit || onDelete || onQuickEdit || timer) && (
        <div
          className={cn(
            "mt-2 flex items-center justify-end gap-1 border-t pt-2",
            toneDividerStyles[tone],
            timer && "justify-between",
            // No desktop as ações flutuam sobre o canto do card só no hover, em vez de reservar uma
            // linha vazia em todo card. O `bg-inherit` pega a cor do card pra cobrir o que estiver
            // embaixo. Com um cronômetro rodando a linha volta pro fluxo e fica sempre visível —
            // senão não há como pará-lo.
            !isRunning &&
              "sm:absolute sm:right-2 sm:bottom-2 sm:mt-0 sm:rounded-md sm:border-t-0 sm:bg-inherit sm:pt-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          {timer && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={timer.isSaving}
              onClick={(event) => {
                event.stopPropagation();
                if (isRunning) timer.onStop();
                else timer.onStart(task.id);
              }}
              aria-label={
                isRunning
                  ? `Finalizar execução de ${task.title}`
                  : `Iniciar execução de ${task.title}`
              }
            >
              {isRunning ? <Square /> : <Play />}
            </Button>
          )}

          <div className="flex items-center">
            {/* Os botões vivem dentro do elemento que carrega os listeners de arrasto, então o
              stopPropagation é explícito — sem ele o clique compete com a ativação do sensor. */}
            {onQuickEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickEdit(task);
                }}
                aria-label={`Mover ${task.title} ou alterar prioridade`}
              >
                <ArrowRightLeft />
              </Button>
            )}
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(task);
                }}
                aria-label={`Editar ${task.title}`}
              >
                <Pencil />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(task);
                }}
                aria-label={`Excluir ${task.title}`}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
