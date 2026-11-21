"use client";

//* Libraries Imports
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

//* Services Imports
import { get, getOne, remove, rpc } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { QueryFilters } from "@/services/api-service";
import type { McpAgentSummary, McpLogDetail, McpLogFilters, McpLogRecord } from "@/lib/mcp-logs";

//* Constants Imports
import { DEFAULT_MCP_LOG_FILTERS, MCP_LOG_LIST_SELECT, UNKNOWN_AGENT } from "@/lib/mcp-logs";

//* Utils Imports
import { getApiErrorMessage } from "@/lib/api-error";
import { appendLogPage } from "@/lib/mcp-logs";

const PAGE_SIZE = 50;

type SummaryResponse = {
  agent: string;
  total: number | string;
  erros: number | string;
  ultima_chamada: string;
};

function toQueryFilters(userId: string, filters: McpLogFilters): QueryFilters {
  return {
    user_id: userId,
    agent:
      filters.agent === "todas"
        ? undefined
        : filters.agent === UNKNOWN_AGENT
          ? null
          : filters.agent,
    status: filters.status === "all" ? undefined : filters.status,
    method: filters.onlyActions ? "tools/call" : undefined,
  };
}

export function useMcpLogs() {
  const [logs, setLogs] = useState<McpLogRecord[]>([]);
  const [summary, setSummary] = useState<McpAgentSummary[]>([]);
  const [filters, setFilters] = useState<McpLogFilters>(DEFAULT_MCP_LOG_FILTERS);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // Troca rápida de filtro: só a resposta da última consulta pode preencher a tabela.
  const requestRef = useRef(0);

  const fetchLogs = useCallback(async (nextFilters: McpLogFilters) => {
    const request = ++requestRef.current;
    setIsLoading(true);
    try {
      const userId = await getAuthenticatedUserId();
      const [page, summaryRows] = await Promise.all([
        get<McpLogRecord>("mcp_logs", {
          select: MCP_LOG_LIST_SELECT,
          filters: toQueryFilters(userId, nextFilters),
          order: [
            { column: "created_at", ascending: false },
            { column: "id", ascending: false },
          ],
          limit: PAGE_SIZE,
        }),
        rpc<SummaryResponse[]>("mcp_logs_resumo"),
      ]);
      if (request !== requestRef.current) return;

      setLogs(page);
      setHasMore(page.length === PAGE_SIZE);
      setSummary(
        (summaryRows ?? []).map((row) => ({
          agent: row.agent,
          total: Number(row.total),
          erros: Number(row.erros),
          ultimaChamada: row.ultima_chamada,
        })),
      );
    } catch (error) {
      if (request !== requestRef.current) return;
      toast.error("Não foi possível carregar os logs do MCP", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao carregar logs do MCP:", error);
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // The request owns its loading state inside fetchLogs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs(filters);
  }, [fetchLogs, filters]);

  async function loadMore() {
    const request = requestRef.current;
    setIsLoadingMore(true);
    try {
      const userId = await getAuthenticatedUserId();
      const page = await get<McpLogRecord>("mcp_logs", {
        select: MCP_LOG_LIST_SELECT,
        filters: toQueryFilters(userId, filters),
        order: [
          { column: "created_at", ascending: false },
          { column: "id", ascending: false },
        ],
        limit: PAGE_SIZE,
        offset: logs.length,
      });
      if (request !== requestRef.current) return;
      setLogs((current) => appendLogPage(current, page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      toast.error("Não foi possível carregar mais logs", {
        description: getApiErrorMessage(error, "Tente novamente."),
      });
      console.error("Erro ao paginar logs do MCP:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Estável entre renders: o diálogo de detalhe depende dela num efeito.
  const fetchLogDetail = useCallback(async (id: string) => {
    const userId = await getAuthenticatedUserId();
    return getOne<McpLogDetail>("mcp_logs", {
      select: `${MCP_LOG_LIST_SELECT},result,ip,user_agent`,
      filters: { id, user_id: userId },
    });
  }, []);

  async function clearLogs() {
    setIsClearing(true);
    try {
      const userId = await getAuthenticatedUserId();
      await remove("mcp_logs", { user_id: userId });
      toast.success("Logs do MCP apagados");
      await fetchLogs(filters);
      return true;
    } catch (error) {
      toast.error("Não foi possível apagar os logs", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao apagar logs do MCP:", error);
      return false;
    } finally {
      setIsClearing(false);
    }
  }

  return {
    logs,
    summary,
    filters,
    setFilters,
    hasMore,
    isLoading,
    isLoadingMore,
    isClearing,
    refresh: () => fetchLogs(filters),
    loadMore,
    fetchLogDetail,
    clearLogs,
  };
}
