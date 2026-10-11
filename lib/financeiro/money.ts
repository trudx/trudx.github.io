/** Dinheiro em centavos inteiros: somar `number` com casas decimais acumula erro de ponto flutuante. */

export function toCents(value: number) {
  return Math.round(value * 100);
}

export function fromCents(cents: number) {
  return cents / 100;
}

export function sumCents(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

/** Variação entre dois períodos. `pct` é `null` quando não há base de comparação (anterior zerado). */
export type Variation = { abs: number; pct: number | null };

export function variation(current: number, previous: number): Variation {
  const abs = current - previous;
  if (previous === 0) return { abs, pct: current === 0 ? 0 : null };
  return { abs, pct: (abs / Math.abs(previous)) * 100 };
}
