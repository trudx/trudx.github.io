"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Select from "@/components/ui/select";
import Table from "@/components/ui/table";

//* Libraries Imports
import { CircleCheck, CircleX, LoaderCircle, ScrollText, Trash2 } from "lucide-react";

//* Types Imports
import type { McpAgentSummary, McpLogFilters, McpLogRecord } from "@/lib/mcp-logs";

//* Utils Imports
import {
  formatLogDateTime,
  formatLogDuration,
  getActionDetail,
  getActionLabel,
  getAgentClassName,
  getAgentLabel,
} from "@/lib/mcp-logs";
import { cn } from "@/lib/utils";

type McpLogsTableProps = {
  logs: McpLogRecord[];
  summary: McpAgentSummary[];
  filters: McpLogFilters;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isClearing: boolean;
  onFiltersChange: (filters: McpLogFilters) => void;
  onLoadMore: () => void;
  onClear: () => void;
  onSelectLog: (log: McpLogRecord) => void;
};

const STATUS_OPTIONS = [
  ["all", "Todos"],
  ["ok", "Sucesso"],
  ["error", "Erro"],
] as const;

export function McpLogsTable({
  logs,
  summary,
  filters,
  hasMore,
  isLoading,
  isLoadingMore,
  isClearing,
  onFiltersChange,
  onLoadMore,
  onClear,
  onSelectLog,
}: McpLogsTableProps) {
  return (
    <Card.CardRoot className="gap-0 py-0">
      <Card.CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <Card.CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" />
            Log de requisições
          </Card.CardTitle>
          <Card.CardDescription className="mt-1">
            Cada chamada das IAs, com argumentos e resposta. Guardado por 90 dias.
          </Card.CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isClearing || (!logs.length && !summary.length)}
          onClick={onClear}
          className="text-xs text-muted-foreground"
        >
          <Trash2 />
          Limpar logs
        </Button>
      </Card.CardHeader>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Tipo de requisição">
          {(
            [
              [true, "Ações"],
              [false, "Todas as requisições"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={label}
              type="button"
              variant={filters.onlyActions === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={filters.onlyActions === value}
              onClick={() => onFiltersChange({ ...filters, onlyActions: value })}
              className="h-7 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>

        <Select.SelectRoot
          value={filters.agent}
          onValueChange={(value) => value && onFiltersChange({ ...filters, agent: value })}
        >
          <Select.SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrar por IA">
            <Select.SelectValue>
              {filters.agent === "todas" ? "Todas as IAs" : getAgentLabel(filters.agent)}
            </Select.SelectValue>
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="todas">Todas as IAs</Select.SelectItem>
            {summary.map((row) => (
              <Select.SelectItem key={row.agent} value={row.agent}>
                {getAgentLabel(row.agent)}
              </Select.SelectItem>
            ))}
          </Select.SelectContent>
        </Select.SelectRoot>

        <div className="flex gap-1" role="group" aria-label="Filtrar por resultado">
          {STATUS_OPTIONS.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={filters.status === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={filters.status === value}
              onClick={() => onFiltersChange({ ...filters, status: value })}
              className="h-8 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <Table.TableRoot>
        <Table.TableHeader>
          <Table.TableRow>
            <Table.TableHead>Quando</Table.TableHead>
            <Table.TableHead>IA</Table.TableHead>
            <Table.TableHead>Ação</Table.TableHead>
            <Table.TableHead>Cliente MCP</Table.TableHead>
            <Table.TableHead>Resultado</Table.TableHead>
            <Table.TableHead className="text-right">Duração</Table.TableHead>
          </Table.TableRow>
        </Table.TableHeader>
        <Table.TableBody>
          {logs.map((log) => {
            const detail = getActionDetail(log);
            return (
              <Table.TableRow
                key={log.id}
                tabIndex={0}
                className={cn("cursor-pointer", log.status === "error" && "bg-red-500/[0.04]")}
                onClick={() => onSelectLog(log)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectLog(log);
                  }
                }}
              >
                <Table.TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatLogDateTime(log.created_at)}
                </Table.TableCell>
                <Table.TableCell>
                  <Badge variant="outline" className={getAgentClassName(log.agent)}>
                    {getAgentLabel(log.agent)}
                  </Badge>
                  {log.agent_model && (
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{log.agent_model}</p>
                  )}
                </Table.TableCell>
                <Table.TableCell className="max-w-80">
                  <p className="font-medium text-foreground">{getActionLabel(log)}</p>
                  {(detail || log.error) && (
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs text-muted-foreground",
                        log.error && "text-red-700 dark:text-red-400",
                      )}
                    >
                      {log.error ?? detail}
                    </p>
                  )}
                </Table.TableCell>
                <Table.TableCell className="text-xs text-muted-foreground">
                  {log.client_name ?? "—"}
                </Table.TableCell>
                <Table.TableCell>
                  {log.status === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CircleCheck className="size-3.5" />
                      Sucesso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                      <CircleX className="size-3.5" />
                      Erro
                    </span>
                  )}
                </Table.TableCell>
                <Table.TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {formatLogDuration(log.duration_ms)}
                </Table.TableCell>
              </Table.TableRow>
            );
          })}

          {isLoading && !logs.length && (
            <Table.TableRow>
              <Table.TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                <LoaderCircle className="mx-auto size-4 animate-spin" />
              </Table.TableCell>
            </Table.TableRow>
          )}
          {!isLoading && !logs.length && (
            <Table.TableRow>
              <Table.TableCell colSpan={6} className="h-36 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                  <ScrollText className="size-5 text-muted-foreground" />
                  <p className="font-medium">Nenhuma requisição registrada</p>
                  <p className="text-xs text-muted-foreground">
                    Quando uma IA usar o MCP, cada chamada aparece aqui.
                  </p>
                </div>
              </Table.TableCell>
            </Table.TableRow>
          )}
        </Table.TableBody>
      </Table.TableRoot>

      {hasMore && (
        <div className="flex justify-center border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className="text-xs"
          >
            {isLoadingMore && <LoaderCircle className="animate-spin" />}
            Carregar mais
          </Button>
        </div>
      )}
    </Card.CardRoot>
  );
}
