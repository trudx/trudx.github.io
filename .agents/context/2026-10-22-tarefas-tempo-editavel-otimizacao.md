# Tarefas: tempo gasto editável, barra de % e card de otimização

## Resumo

- O tempo gasto de uma tarefa pode ser corrigido no Sheet de edição rápida (campo "Tempo gasto (minutos)").
- O card da tarefa e o Sheet mostram uma barra com a % do tempo real em relação ao previsto (`average_duration_minutes`). Acima de 100% a barra enche e aparece ⚠.
- Novo card "Otimização" na página de tarefas: média, entre as tarefas com tempo registrado, de quanto do previsto foi gasto. `-X%` = mais rápido que o previsto; `+X%` = estourou.

## Arquivos

- `lib/task-time-efficiency.ts` (novo) — `getTimeUsagePercent`, `getAverageTimeUsage`.
- `app/dashboard/tasks/_components/task-time-progress.tsx` e `task-optimization-card.tsx` (novos).
- `hooks/use-task-timer.ts` — `setTaskSeconds`.
- `task-card.tsx`, `task-quick-edit-sheet.tsx`, `page.tsx`, `_components/index.ts`.

## Decisões

- **Sem mudança de schema/SQL.** Editar o tempo substitui as entradas finalizadas da tarefa por uma única, com `ended_at` ancorado no fim da entrada mais recente (o tempo continua no mesmo dia dos totais). Não existe filtro "not null" no `api-service`, então filtra-se no cliente e remove-se por ids. O cronômetro em curso não é tocado. Salvar 0 apaga o tempo.
- A média é das razões por tarefa (cada tarefa pesa igual), só com tarefas com previsão > 0 e tempo > 0.
- Nesse fluxo a escrita usa `started_at`/`ended_at` do relógio do navegador (correção manual, diferente do cronômetro).

## Pendências

- Nada testado contra o banco; `tsc` e `eslint` limpos.
