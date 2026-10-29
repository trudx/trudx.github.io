"use client";

//* Components Imports
import Skeleton from "@/components/ui/skeleton";

//* Libraries Imports
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { DashboardModel } from "@/lib/financeiro/dashboard";
import type { Variation } from "@/lib/financeiro/money";

//* Utils Imports
import { formatPct } from "@/lib/financeiro/format";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type FinanceiroResumoProps = {
  model: DashboardModel;
  bancoName: (id: string | null) => string;
  isLoadingSaldo: boolean;
  hasSaldoError: boolean;
  onOpenSaldo: () => void;
};

function VariationLine({
  change,
  current,
  goodWhen,
}: {
  change: Variation;
  current: number;
  goodWhen: "up" | "down";
}) {
  const direction = change.abs === 0 ? "flat" : change.abs > 0 ? "up" : "down";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const isGood = direction !== "flat" && direction === goodWhen;

  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
      <Icon
        className={cn(
          "size-3.5",
          direction !== "flat" &&
            (isGood
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"),
        )}
        aria-hidden
      />
      {formatPct(change.pct, current)} vs. período anterior
    </p>
  );
}

export function FinanceiroResumo({
  model,
  bancoName,
  isLoadingSaldo,
  hasSaldoError,
  onOpenSaldo,
}: FinanceiroResumoProps) {
  const { isHidden, formatValor } = useFinanceiroPrivacy();
  const { balance, totals, comparedTotals: comparedCurrent } = model;
  const negative = (cents: number) => !isHidden && cents < 0;
  const covered = model.bankBalances.filter((bank) => bank.ultimaCobertura);
  const semReferencia = balance.bancosSemReferencia.map(bancoName);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={onOpenSaldo}
          className="rounded-2xl border bg-muted p-5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <p className="text-xs font-semibold opacity-75">
            {balance.isCompleto || balance.confirmado !== null
              ? "Saldo estimado"
              : "Saldo calculado"}
          </p>
          {isLoadingSaldo ? (
            <Skeleton className="mt-4 h-9 w-36" />
          ) : hasSaldoError ? (
            <p className="mt-4 text-sm text-muted-foreground">Indisponível</p>
          ) : (
            <p
              className={cn(
                "mt-4 text-3xl font-display font-bold",
                negative(balance.estimado) && "text-rose-700",
              )}
            >
              {formatValor(balance.estimado / 100)}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {balance.confirmado !== null
              ? `Confirmado pelo banco: ${formatValor(balance.confirmado / 100)}`
              : "Sem saldo bancário validado — calculado do histórico"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Ver detalhes por banco</p>
        </button>

        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold text-muted-foreground">Receitas do período</p>
          <p className="mt-4 text-3xl font-display font-bold text-emerald-700 dark:text-emerald-400">
            {formatValor(totals.receitas / 100)}
          </p>
          <VariationLine
            change={model.receitasVar}
            current={comparedCurrent.receitas}
            goodWhen="up"
          />
        </div>

        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold text-muted-foreground">Despesas do período</p>
          <p className="mt-4 text-3xl font-display font-bold">
            {formatValor(totals.despesas / 100)}
          </p>
          <VariationLine
            change={model.despesasVar}
            current={comparedCurrent.despesas}
            goodWhen="down"
          />
        </div>

        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold text-muted-foreground">Resultado líquido</p>
          <p
            className={cn(
              "mt-4 text-3xl font-display font-bold",
              negative(totals.resultado) && "text-rose-700",
            )}
          >
            {formatValor(totals.resultado / 100)}
          </p>
          <VariationLine
            change={model.resultadoVar}
            current={comparedCurrent.resultado}
            goodWhen="up"
          />
        </div>
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        {covered.map((bank) => (
          <li key={bank.bancoId ?? "none"}>
            Última conciliação {bancoName(bank.bancoId)}:{" "}
            {formatDate(bank.ultimaCobertura as string)}
          </li>
        ))}
        {balance.provisoriosQtd > 0 && (
          <li>
            Existem {balance.provisoriosQtd} lançamento{balance.provisoriosQtd === 1 ? "" : "s"}{" "}
            provisório
            {balance.provisoriosQtd === 1 ? "" : "s"} aguardando confirmação.
          </li>
        )}
        {balance.confirmado !== null && balance.naoConfirmado !== 0 && (
          <li>
            Saldo estimado inclui {formatValor(Math.abs(balance.naoConfirmado) / 100)} em
            movimentações pendentes.
          </li>
        )}
        {semReferencia.length > 0 && (
          <li>
            Saldo parcial: {semReferencia.join(", ")} sem saldo de referência. Informe um saldo
            conferido ou importe um extrato.
          </li>
        )}
        {totals.internosQtd > 0 && (
          <li>
            {totals.internosQtd} movimentação{totals.internosQtd === 1 ? "" : "ões"} interna
            {totals.internosQtd === 1 ? "" : "s"} (transferências/faturas) fora de receitas e
            despesas.
          </li>
        )}
      </ul>
    </div>
  );
}
