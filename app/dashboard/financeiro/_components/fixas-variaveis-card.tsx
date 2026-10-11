"use client";

//* Components Imports
import { FinanceiroCartao } from "./financeiro-cartao";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { FixedVariable } from "@/lib/financeiro/analytics";

type FixasVariaveisCardProps = { data: FixedVariable };

export function FixasVariaveisCard({ data }: FixasVariaveisCardProps) {
  const { formatValor } = useFinanceiroPrivacy();
  const total = data.fixoRealizado + data.variavel;

  return (
    <FinanceiroCartao
      title="Fixas × variáveis"
      subtitle="Só gastos fixos já realizados entram no percentual"
    >
      {total === 0 && data.fixoPrevisto === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Sem despesas no período.</p>
      ) : (
        <div className="space-y-4">
          <div
            role="img"
            aria-label={`Fixas ${data.fixoPct.toFixed(0)}%, variáveis ${data.variavelPct.toFixed(0)}%`}
            className="flex h-3 gap-0.5 overflow-hidden rounded-full"
          >
            {data.fixoRealizado > 0 && (
              <span
                className="rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                style={{ width: `${data.fixoPct}%` }}
              />
            )}
            {data.variavel > 0 && (
              <span
                className="rounded-full bg-[#eb6834] dark:bg-[#d95926]"
                style={{ width: `${data.variavelPct}%` }}
              />
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-[2px] bg-[#2a78d6] dark:bg-[#3987e5]" />
                Fixas realizadas
              </dt>
              <dd className="tabular-nums">
                {formatValor(data.fixoRealizado / 100)} · {data.fixoPct.toFixed(0)}%
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-[2px] bg-[#eb6834] dark:bg-[#d95926]" />
                Variáveis
              </dt>
              <dd className="tabular-nums">
                {formatValor(data.variavel / 100)} · {data.variavelPct.toFixed(0)}%
              </dd>
            </div>
            {data.fixoPrevisto > 0 && (
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <dt>Fixas previstas (aguardando extrato)</dt>
                <dd className="tabular-nums">{formatValor(data.fixoPrevisto / 100)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </FinanceiroCartao>
  );
}
