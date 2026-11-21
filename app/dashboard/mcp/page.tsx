"use client";

//* Components Imports
import Button from "@/components/ui/button";

import {
  McpAgentSummary,
  McpConfirmDialog,
  McpConnectionCard,
  McpLogDetailDialog,
  McpLogsTable,
} from "./_components";

//* Libraries Imports
import { useState } from "react";
import { Plug, RefreshCw } from "lucide-react";

//* Hooks Imports
import { useMcpLogs } from "@/hooks/use-mcp-logs";
import { useMcpToken } from "@/hooks/use-mcp-token";

//* Types Imports
import type { McpLogRecord } from "@/lib/mcp-logs";

//* Utils Imports
import env from "@/lib/env";
import { getMcpEndpoint } from "@/lib/mcp-logs";
import { cn } from "@/lib/utils";

export default function McpPage() {
  const {
    token,
    isLoading: isTokenLoading,
    isSaving,
    regenerateToken,
    revokeToken,
  } = useMcpToken();
  const {
    logs,
    summary,
    filters,
    setFilters,
    hasMore,
    isLoading,
    isLoadingMore,
    isClearing,
    refresh,
    loadMore,
    fetchLogDetail,
    clearLogs,
  } = useMcpLogs();
  const [selectedLog, setSelectedLog] = useState<McpLogRecord | null>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="trudx-kicker mb-1.5 text-muted-foreground">Integrações</p>
          <h1 className="flex items-center gap-2 text-xl font-display font-bold text-foreground">
            <Plug className="size-5" />
            MCP de tarefas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Conecte Claude, ChatGPT ou outra IA às suas tarefas e acompanhe tudo o que cada uma fez.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          className="h-8 px-3 text-xs font-medium"
          onClick={() => void refresh()}
        >
          <RefreshCw className={cn(isLoading && "animate-spin")} />
          Atualizar logs
        </Button>
      </div>

      <McpConnectionCard
        endpoint={getMcpEndpoint(env.NEXT_PUBLIC_SUPABASE_URL)}
        token={token}
        isLoading={isTokenLoading}
        isSaving={isSaving}
        onRegenerate={regenerateToken}
        onRevoke={revokeToken}
      />

      <McpAgentSummary
        summary={summary}
        selectedAgent={filters.agent}
        onSelectAgent={(agent) => setFilters({ ...filters, agent })}
      />

      <McpLogsTable
        logs={logs}
        summary={summary}
        filters={filters}
        hasMore={hasMore}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isClearing={isClearing}
        onFiltersChange={setFilters}
        onLoadMore={() => void loadMore()}
        onClear={() => setIsClearOpen(true)}
        onSelectLog={setSelectedLog}
      />

      <McpLogDetailDialog
        log={selectedLog}
        fetchDetail={fetchLogDetail}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
      <McpConfirmDialog
        open={isClearOpen}
        title="Apagar todos os logs?"
        description="O histórico de requisições de todas as IAs será apagado. O token continua valendo."
        actionLabel="Apagar logs"
        onOpenChange={setIsClearOpen}
        onConfirm={() => {
          setIsClearOpen(false);
          void clearLogs();
        }}
      />
    </section>
  );
}
