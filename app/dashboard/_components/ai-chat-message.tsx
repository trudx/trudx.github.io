"use client";

//* Libraries Imports
import { Check, CircleAlert, Loader2 } from "lucide-react";

//* Types Imports
import type { ChatEntry } from "@/lib/ai/types";

const ACTION_LABELS: Record<string, string> = {
  resources_describe: "Consultando recursos disponíveis",
  records_list: "Consultando registros",
  record_create: "Criando registro",
  record_update: "Atualizando registro",
  record_delete: "Excluindo registro",
  event_create_with_task: "Criando evento e tarefa",
  financeiro_analyze: "Analisando o financeiro",
  financeiro_balances: "Consultando saldos",
  timer_control: "Consultando ou ajustando cronômetro",
};

export function AiChatMessage({ entry, pending }: { entry: ChatEntry; pending: boolean }) {
  const user = entry.role === "user";
  return (
    <article
      className={`min-w-0 ${user ? "ml-8 rounded-xl bg-primary px-3.5 py-3 text-primary-foreground" : "mr-3 space-y-3"}`}
    >
      <p
        className={`mb-1 text-[0.65rem] font-semibold uppercase tracking-wider ${user ? "opacity-65" : "text-muted-foreground"}`}
      >
        {user ? "Você" : "Assistente"}
      </p>
      {Boolean(entry.activities?.length) && (
        <ul
          className="space-y-1.5 rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground"
          aria-label="Ações do assistente"
        >
          {entry.activities?.map((activity) => (
            <li key={activity.id} className="space-y-1">
              <div className="flex items-center gap-2">
                {activity.status === "running" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : activity.status === "success" ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <CircleAlert className="size-3.5 shrink-0 text-destructive" />
                )}
                <span className={activity.status === "error" ? "text-destructive" : ""}>
                  {ACTION_LABELS[activity.name] ?? "Executando ação"}
                  {activity.status === "success"
                    ? " · concluído"
                    : activity.status === "error"
                      ? " · falhou"
                      : "..."}
                </span>
              </div>
              {activity.detail && <p className="pl-5 text-destructive">{activity.detail}</p>}
            </li>
          ))}
        </ul>
      )}
      {entry.content && (
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-6 ${entry.error ? "text-destructive" : ""}`}
        >
          {entry.content}
        </p>
      )}
      {pending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {entry.activities?.length ? "Preparando resposta..." : "Pensando..."}
        </p>
      )}
    </article>
  );
}
