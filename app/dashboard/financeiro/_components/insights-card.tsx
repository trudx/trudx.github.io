"use client";

//* Components Imports
import { FinanceiroCartao } from "./financeiro-cartao";

//* Libraries Imports
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

//* Types Imports
import type { Insight } from "@/lib/financeiro/analytics";

const icons = { info: Info, alerta: AlertTriangle, ok: CheckCircle2 } as const;

export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <FinanceiroCartao title="Insights" subtitle="Calculados a partir dos seus dados, sem IA">
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há dados suficientes para insights confiáveis.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((insight) => {
            const Icon = icons[insight.tone];
            return (
              <li key={insight.id} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{insight.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </FinanceiroCartao>
  );
}
