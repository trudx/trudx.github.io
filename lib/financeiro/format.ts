import type { Granularity } from "./analytics.ts";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Rótulo curto do eixo X (sem Date, para não escorregar um dia por fuso). */
export function bucketLabel(key: string, granularity: Granularity) {
  const [year, month, day] = key.split("-");
  if (granularity === "mes") return `${MONTHS[Number(month) - 1]}/${year.slice(2)}`;
  return `${day}/${month}`;
}

export function bucketTitle(key: string, granularity: Granularity) {
  const [year, month, day] = key.split("-");
  if (granularity === "mes") return `${MONTHS[Number(month) - 1]} de ${year}`;
  if (granularity === "semana") return `Semana de ${day}/${month}/${year}`;
  return `${day}/${month}/${year}`;
}

/** Variação percentual legível; `null` (sem base de comparação) vira "novo"/"—". */
export function formatPct(pct: number | null, current: number) {
  if (pct === null) return current === 0 ? "—" : "novo";
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
