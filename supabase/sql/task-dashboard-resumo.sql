-- Resumo de tarefas da Visão geral numa consulta só (sem baixar todas as tarefas pro navegador).
-- Rodar DEPOIS de task-flags-e-etapas.sql (usa task_columns.stage). Script aditivo: só cria uma
-- função; não altera nem apaga dados.
--
-- Etapa de cada tarefa, pela posição da coluna em relação às colunas-marco (mesma regra do
-- kanban, lib/task-stages.ts): da coluna de conclusão em diante = done; da coluna de pendência
-- pra trás = pending; o resto = progress. Se as marcas se cruzarem, done vence.
-- As contagens por data (hoje, amanhã, atrasadas) ignoram as concluídas.

create or replace function public.task_dashboard_summary(p_today date)
returns table (
  due_today bigint,
  due_tomorrow bigint,
  overdue bigint,
  pending bigint,
  in_progress bigint,
  done bigint,
  has_pending_column boolean,
  has_done_column boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with marks as (
    select
      max(c.position) filter (where c.stage = 'pending') as pending_position,
      min(c.position) filter (where c.stage = 'done') as done_position
    from public.task_columns c
    where c.user_id = (select auth.uid())
  ),
  staged as (
    select
      t.due_date,
      case
        when m.done_position is not null and c.position >= m.done_position then 'done'
        when m.pending_position is not null and c.position <= m.pending_position then 'pending'
        else 'progress'
      end as stage
    from public.tasks t
    join public.task_columns c on c.id = t.column_id
    cross join marks m
    where t.user_id = (select auth.uid())
  )
  select
    count(*) filter (where s.stage <> 'done' and s.due_date = p_today),
    count(*) filter (where s.stage <> 'done' and s.due_date = p_today + 1),
    count(*) filter (where s.stage <> 'done' and s.due_date < p_today),
    count(*) filter (where s.stage = 'pending'),
    count(*) filter (where s.stage = 'progress'),
    count(*) filter (where s.stage = 'done'),
    (select m.pending_position is not null from marks m),
    (select m.done_position is not null from marks m)
  from staged s;
$$;

revoke all on function public.task_dashboard_summary(date) from public, anon;
grant execute on function public.task_dashboard_summary(date) to authenticated;
