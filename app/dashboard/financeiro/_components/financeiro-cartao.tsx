"use client";

//* Libraries Imports
import type { ReactNode } from "react";

//* Utils Imports
import { cn } from "@/lib/utils";

type FinanceiroCartaoProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

/** Moldura discreta compartilhada pelos blocos de análise (borda suave, sem sombra pesada). */
export function FinanceiroCartao({ title, subtitle, children, className }: FinanceiroCartaoProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
