export type TaskTimeComparison = {
  estimatedMinutes: number;
  loggedSeconds: number;
};

/** Quanto do tempo previsto foi usado, em %. Passa de 100 quando estourou. `null` sem previsão. */
export function getTimeUsagePercent({ estimatedMinutes, loggedSeconds }: TaskTimeComparison) {
  if (estimatedMinutes <= 0) return null;
  return (loggedSeconds / (estimatedMinutes * 60)) * 100;
}

/**
 * Média, entre as tarefas com previsão e tempo registrado, de quanto do previsto foi gasto.
 * Cada tarefa pesa igual (média das razões), pra uma tarefa longa não esconder as curtas.
 * `optimizationPercent` positivo = executou mais rápido que o previsto; negativo = estourou.
 */
export function getAverageTimeUsage(items: TaskTimeComparison[]) {
  const percents = items
    .filter((item) => item.loggedSeconds > 0)
    .map(getTimeUsagePercent)
    .filter((percent): percent is number => percent !== null);

  if (percents.length === 0) return null;

  const averageUsagePercent = percents.reduce((sum, percent) => sum + percent, 0) / percents.length;
  return {
    sampleSize: percents.length,
    averageUsagePercent,
    optimizationPercent: 100 - averageUsagePercent,
  };
}
