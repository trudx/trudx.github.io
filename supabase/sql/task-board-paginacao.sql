-- Paginação do kanban por coluna e contadores separados.
-- Rodar DEPOIS de task-flags-e-etapas.sql (usa task_flag_links). Script aditivo: só cria funções e
-- um índice; não altera nem apaga dados.
--
-- Filtros (p_filters, jsonb), todos opcionais:
--   clienteIds: uuid[] em texto; "sem-cliente" = tarefas sem cliente
--   priorities: ["low" | "medium" | "high"]
--   flagIds: uuid[] em texto; "sem-flag" = tarefas sem flag (OU entre os itens)
--   weekStart: "YYYY-MM-DD" (domingo); a semana vai até o sábado
--   searchText: trecho do título ou da descrição

create index if not exists tasks_user_column_created_idx
  on public.tasks (user_id, column_id, created_at desc, id desc);

-- Versão anterior deste script (função que devolvia o conjunto filtrado). Só existe se ela já foi
-- rodada; é substituída por task_matches_filters.
drop function if exists public.task_board_filtered(jsonb);

-- Filtro de flag (OU entre as flags; "sem-flag" = tarefa sem nenhuma). Fica numa função à parte
-- porque precisa de subconsulta, e subconsulta impede o Postgres de embutir task_matches_filters.
-- Só é chamada quando o filtro de flag está ativo.
create or replace function public.task_matches_flag_filter(p_task_id uuid, p_flag_ids jsonb)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
      select 1 from public.task_flag_links l
      where l.task_id = p_task_id and p_flag_ids ? l.flag_id::text
    )
    or (
      p_flag_ids ? 'sem-flag'
      and not exists (select 1 from public.task_flag_links l where l.task_id = p_task_id)
    );
$$;

-- A tarefa passa nos filtros? Predicado por linha em vez de função que devolve conjunto: assim as
-- consultas abaixo leem public.tasks direto e o planejador usa o índice (usuário, coluna, ordem)
-- com o LIMIT, avaliando o filtro só nas linhas que percorre.
--
-- Escrita pra ser EMBUTIDA pelo Postgres na consulta que a chama (medido: contagem de 4 mil
-- tarefas cai de ~170 ms pra ~3 ms). Pra isso ela precisa: ser SQL de uma expressão só, sem
-- subconsulta (por isso a flag está em task_matches_flag_filter) e SEM `set search_path` — função
-- com SET nunca é embutida. Os nomes já são todos qualificados, então o SET não protegeria nada.
-- Não é security definer: roda com as permissões e a RLS de quem chama.
create or replace function public.task_matches_filters(t public.tasks, p_filters jsonb)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      coalesce(jsonb_array_length(p_filters -> 'clienteIds'), 0) = 0
      or (p_filters -> 'clienteIds') ? t.cliente_id::text
      or (t.cliente_id is null and (p_filters -> 'clienteIds') ? 'sem-cliente')
    )
    and (
      coalesce(jsonb_array_length(p_filters -> 'priorities'), 0) = 0
      or (p_filters -> 'priorities') ? t.priority::text
    )
    and (
      coalesce(jsonb_array_length(p_filters -> 'flagIds'), 0) = 0
      or public.task_matches_flag_filter(t.id, p_filters -> 'flagIds')
    )
    and (
      nullif(p_filters ->> 'weekStart', '') is null
      or t.due_date between (p_filters ->> 'weekStart')::date
        and (p_filters ->> 'weekStart')::date + 6
    )
    and (
      nullif(btrim(coalesce(p_filters ->> 'searchText', '')), '') is null
      or t.title ilike '%' || replace(replace(replace(btrim(p_filters ->> 'searchText'), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or t.description ilike '%' || replace(replace(replace(btrim(p_filters ->> 'searchText'), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    ),
    false
  );
$$;

-- Uma página de uma coluna, mais recentes primeiro. Paginação por cursor (created_at, id) em vez de
-- offset: mover um card de coluna não faz a próxima página pular nem repetir cards. O filtro de
-- usuário, coluna e cursor fica explícito aqui pra casar com o índice e parar no LIMIT.
create or replace function public.task_board_page(
  p_column_id uuid,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select
    to_jsonb(t) || jsonb_build_object(
      'flag_ids',
      coalesce(
        (select jsonb_agg(l.flag_id) from public.task_flag_links l where l.task_id = t.id),
        '[]'::jsonb
      )
    )
  from public.tasks t
  where t.user_id = (select auth.uid())
    and t.column_id = p_column_id
    and (
      p_before_created_at is null
      or (t.created_at, t.id) < (p_before_created_at, p_before_id)
    )
    and public.task_matches_filters(t, p_filters)
  order by t.created_at desc, t.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Contador por coluna numa passada só: `total` ignora filtros (decide se a coluna pode ser
-- excluída); `filtered` é o número mostrado no cabeçalho.
create or replace function public.task_board_counts(p_filters jsonb default '{}'::jsonb)
returns table (column_id uuid, total bigint, filtered bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.column_id,
    count(*),
    count(*) filter (where public.task_matches_filters(t, p_filters))
  from public.tasks t
  where t.user_id = (select auth.uid())
  group by t.column_id;
$$;

-- Quantas tarefas usam cada flag (modal de flags).
create or replace function public.task_flag_counts()
returns table (flag_id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.flag_id, count(*)
  from public.task_flag_links l
  where l.user_id = (select auth.uid())
  group by l.flag_id;
$$;

revoke all on function public.task_matches_flag_filter(uuid, jsonb) from public, anon;
revoke all on function public.task_matches_filters(public.tasks, jsonb) from public, anon;
revoke all on function public.task_board_page(uuid, jsonb, integer, timestamptz, uuid) from public, anon;
revoke all on function public.task_board_counts(jsonb) from public, anon;
revoke all on function public.task_flag_counts() from public, anon;
grant execute on function public.task_matches_flag_filter(uuid, jsonb) to authenticated;
grant execute on function public.task_matches_filters(public.tasks, jsonb) to authenticated;
grant execute on function public.task_board_page(uuid, jsonb, integer, timestamptz, uuid) to authenticated;
grant execute on function public.task_board_counts(jsonb) to authenticated;
grant execute on function public.task_flag_counts() to authenticated;
