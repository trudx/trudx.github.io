"use client";

//* Components Imports
import Tooltip from "@/components/ui/tooltip";

//* Types Imports
import type { FinanceiroStatus } from "@/lib/financeiro/types";

//* Utils Imports
import { cn } from "@/lib/utils";

export type StatusExibido = FinanceiroStatus | "revisao";

const statusConfig: Record<StatusExibido, { label: string; dot: string; hint: string }> = {
  provisorio: {
    label: "Provisório",
    dot: "bg-amber-500",
    hint: "Lançado à mão, aguardando o extrato do banco.",
  },
  confirmado: {
    label: "Confirmado",
    dot: "bg-muted-foreground/60",
    hint: "Lançamento definitivo (do extrato ou confirmado por você).",
  },
  conciliado: {
    label: "Conciliado",
    dot: "bg-emerald-500",
    hint: "Lançamento manual casado com o extrato oficial do banco.",
  },
  revisao: {
    label: "Revisão necessária",
    dot: "bg-rose-500",
    hint: "Provisório anterior ao último saldo confirmado e sem correspondência no extrato. Confirme, ajuste ou exclua.",
  },
};

type ConciliacaoStatusBadgeProps = {
  status: FinanceiroStatus;
  /** Provisório mais antigo que o saldo de referência do banco: o extrato já cobre o dia e ele não casou. */
  isObsoleto?: boolean;
  className?: string;
};

/** Indicador discreto (ponto + texto) do estado de conciliação. */
export function ConciliacaoStatusBadge({
  status,
  isObsoleto,
  className,
}: ConciliacaoStatusBadgeProps) {
  const shown: StatusExibido = status === "provisorio" && isObsoleto ? "revisao" : status;
  const config = statusConfig[shown];

  return (
    <Tooltip.TooltipRoot>
      <Tooltip.TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", config.dot)} />
        {config.label}
      </Tooltip.TooltipTrigger>
      <Tooltip.TooltipContent>{config.hint}</Tooltip.TooltipContent>
    </Tooltip.TooltipRoot>
  );
}
