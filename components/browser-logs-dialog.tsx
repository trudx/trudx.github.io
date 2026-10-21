"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";

//* Libraries Imports
import { useCallback, useState, useSyncExternalStore } from "react";
import { Download, ScrollText, Trash2 } from "lucide-react";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";

//* Types Imports
import type { BrowserLog } from "@/lib/browser-logs";

//* Utils Imports
import {
  browserLogStorageError,
  clearBrowserLogs,
  readBrowserLogs,
  subscribeBrowserLogs,
} from "@/lib/browser-logs";

const EMPTY_LOGS: BrowserLog[] = [];

export function BrowserLogsDialog({ compact = false }: { compact?: boolean }) {
  const { userId } = useAiSettings();
  const subscribe = useCallback(
    (listener: () => void) => (userId ? subscribeBrowserLogs(userId, listener) : () => {}),
    [userId],
  );
  const snapshot = useCallback(() => (userId ? readBrowserLogs(userId) : EMPTY_LOGS), [userId]);
  const logs = useSyncExternalStore(subscribe, snapshot, () => EMPTY_LOGS);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const visible = logs
    .filter(
      (log) =>
        (level === "all" || log.level === level) &&
        `${log.message} ${log.source} ${log.details ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice()
    .reverse();

  function handleDownload() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "trudx-browser-logs.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog.DialogRoot>
      <Dialog.DialogTrigger
        render={
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size={compact ? "icon-sm" : "default"}
            aria-label="Abrir logs do navegador"
          />
        }
      >
        <ScrollText className="size-4" />
        {!compact && "Logs do navegador"}
      </Dialog.DialogTrigger>
      <Dialog.DialogContent className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-3xl">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>Logs do navegador</Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Últimos {logs.length} de 100 registros desta conta, salvos neste navegador. Ao entrar um
            novo após o limite, o mais antigo é apagado. Tokens e senhas são ocultados.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        {userId && browserLogStorageError(userId) && (
          <p role="alert" className="text-sm text-destructive">
            {browserLogStorageError(userId)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Buscar nos logs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar mensagem, origem ou diagnóstico"
            className="min-w-40 flex-1"
          />
          <select
            aria-label="Filtrar nível do log"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-xs"
          >
            <option value="all">Todos os níveis</option>
            <option value="error">Erros</option>
            <option value="warn">Avisos</option>
            <option value="info">Informações</option>
            <option value="debug">Debug</option>
          </select>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={!logs.length}
            onClick={handleDownload}
            aria-label="Baixar logs em JSON"
          >
            <Download className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={!logs.length}
            onClick={() => userId && clearBrowserLogs(userId)}
            aria-label="Limpar logs"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div
          className="min-h-40 space-y-2 overflow-y-auto overscroll-contain"
          role="log"
          aria-label="Registros do navegador"
        >
          {!visible.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado.
            </p>
          ) : (
            visible.map((log) => (
              <details key={log.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                <summary className="cursor-pointer break-words text-xs leading-5">
                  <span
                    className={
                      log.level === "error" ? "font-semibold text-destructive" : "font-semibold"
                    }
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className="mx-2 text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString("pt-BR")} · {log.source}
                  </span>
                  {log.message}
                </summary>
                {log.details && (
                  <pre className="mt-2 whitespace-pre-wrap break-words border-t pt-2 font-mono text-[0.65rem] leading-5 text-muted-foreground">
                    {log.details}
                  </pre>
                )}
              </details>
            ))
          )}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Se aparecer “sem status HTTP”, o JavaScript não recebeu uma resposta legível. CORS, DNS,
          TLS e bloqueios de extensões podem ter a mesma mensagem; consulte a aba Rede do DevTools
          para distinguir. Mensagens internas do navegador podem não estar disponíveis ao app.
        </p>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
