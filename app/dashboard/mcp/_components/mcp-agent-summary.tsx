"use client";

//* Components Imports
import Card from "@/components/ui/card";

//* Libraries Imports
import { Bot } from "lucide-react";

//* Types Imports
import type { McpAgentSummary as McpAgentSummaryRow } from "@/lib/mcp-logs";

//* Utils Imports
import { formatLogDateTime, getAgentClassName, getAgentLabel } from "@/lib/mcp-logs";
import { cn } from "@/lib/utils";

type McpAgentSummaryProps = {
  summary: McpAgentSummaryRow[];
  selectedAgent: string;
  onSelectAgent: (agent: string) => void;
};

export function McpAgentSummary({ summary, selectedAgent, onSelectAgent }: McpAgentSummaryProps) {
  if (!summary.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Requisições por IA">
      {summary.map((row) => {
        const isSelected = selectedAgent === row.agent;
        return (
          <button
            key={row.agent}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectAgent(isSelected ? "todas" : row.agent)}
            className="text-left"
          >
            <Card.CardRoot
              size="sm"
              className={cn(
                "transition-colors hover:bg-muted/40",
                isSelected && "ring-2 ring-foreground/30",
              )}
            >
              <Card.CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium",
                      getAgentClassName(row.agent),
                    )}
                  >
                    <Bot className="size-3" />
                    {getAgentLabel(row.agent)}
                  </span>
                  {row.erros > 0 && (
                    <span className="text-xs text-red-700 tabular-nums dark:text-red-400">
                      {row.erros} {row.erros === 1 ? "erro" : "erros"}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-display font-bold tabular-nums">{row.total}</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Última: {formatLogDateTime(row.ultimaChamada)}
                </p>
              </Card.CardContent>
            </Card.CardRoot>
          </button>
        );
      })}
    </div>
  );
}
