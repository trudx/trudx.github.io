"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Dialog from "@/components/ui/dialog";

import { McpJsonBlock } from "./mcp-json-block";

//* Libraries Imports
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

//* Types Imports
import type { McpLogDetail, McpLogRecord } from "@/lib/mcp-logs";

//* Utils Imports
import {
  formatLogDateTime,
  formatLogDuration,
  getActionLabel,
  getAgentClassName,
  getAgentLabel,
} from "@/lib/mcp-logs";
import { cn } from "@/lib/utils";

type McpLogDetailDialogProps = {
  log: McpLogRecord | null;
  onOpenChange: (open: boolean) => void;
  fetchDetail: (id: string) => Promise<McpLogDetail | null>;
};

export function McpLogDetailDialog({ log, onOpenChange, fetchDetail }: McpLogDetailDialogProps) {
  const [detail, setDetail] = useState<McpLogDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!log) return;
    let active = true;
    // Reset ao trocar de linha: sem isso o detalhe anterior aparece por um instante.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setFailed(false);
    fetchDetail(log.id)
      .then((row) => active && setDetail(row))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [log, fetchDetail]);

  const current = detail ?? log;
  const fields: [string, string | null | undefined][] = current
    ? [
        ["Data", formatLogDateTime(current.created_at)],
        ["Modelo", current.agent_model],
        [
          "Cliente MCP",
          current.client_name &&
            `${current.client_name}${current.client_version ? ` ${current.client_version}` : ""}`,
        ],
        ["Método", current.method],
        ["Ferramenta", current.tool],
        ["Duração", formatLogDuration(current.duration_ms)],
        ["Sessão", current.session_id],
        ["IP", detail?.ip],
        ["User agent", detail?.user_agent],
      ]
    : [];

  return (
    <Dialog.DialogRoot open={Boolean(log)} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {current && (
          <>
            <Dialog.DialogHeader>
              <Dialog.DialogTitle className="flex flex-wrap items-center gap-2">
                {getActionLabel(current)}
                <Badge variant="outline" className={getAgentClassName(current.agent)}>
                  {getAgentLabel(current.agent)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    current.status === "ok"
                      ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "border-red-500/30 text-red-700 dark:text-red-400",
                  )}
                >
                  {current.status === "ok" ? "Sucesso" : "Erro"}
                </Badge>
              </Dialog.DialogTitle>
              <Dialog.DialogDescription>
                Requisição completa recebida pelo MCP e o que foi devolvido à IA.
              </Dialog.DialogDescription>
            </Dialog.DialogHeader>

            <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-[8rem_1fr]">
              {fields
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-all font-mono">{value}</dd>
                  </div>
                ))}
            </dl>

            {current.error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
                {current.error}
              </p>
            )}

            <McpJsonBlock title="Argumentos" value={current.arguments} />
            {detail ? (
              <McpJsonBlock title="Resposta" value={detail.result} />
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {failed ? (
                  "Não foi possível carregar a resposta deste log."
                ) : (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" />
                    Carregando resposta...
                  </>
                )}
              </p>
            )}
          </>
        )}
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
