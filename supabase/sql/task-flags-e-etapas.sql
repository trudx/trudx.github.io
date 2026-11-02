-- Flags das tarefas e colunas-marco (pendência / conclusão) do kanban.
-- Script aditivo: cria tabelas novas e uma coluna opcional em task_columns; não altera dados.

-- 1. Coluna-marco: no máximo uma coluna "pending" e uma "done" por usuário.
alter table public.task_columns
  add column if not exists stage text check (stage in ('pending', 'done'));

create unique index if not exists task_columns_user_stage_key
  on public.task_columns (user_id, stage)
  where stage is not null;

-- 2. Cadastro de flags.
create table if not exists public.task_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists task_flags_user_name_key
  on public.task_flags (user_id, lower(btrim(name)));

alter table public.task_flags enable row level security;
revoke all on table public.task_flags from anon;
grant select, insert, update, delete on table public.task_flags to authenticated;

drop policy if exists "Users manage their task flags" on public.task_flags;
create policy "Users manage their task flags"
  on public.task_flags for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Vínculo tarefa ↔ flag. Excluir a tarefa ou a flag leva o vínculo junto.
create table if not exists public.task_flag_links (
  task_id uuid not null references public.tasks (id) on delete cascade,
  flag_id uuid not null references public.task_flags (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, flag_id)
);

create index if not exists task_flag_links_flag_id_idx on public.task_flag_links (flag_id);
create index if not exists task_flag_links_user_id_idx on public.task_flag_links (user_id);

alter table public.task_flag_links enable row level security;
revoke all on table public.task_flag_links from anon;
grant select, insert, delete on table public.task_flag_links to authenticated;

-- O vínculo só vale se a tarefa e a flag forem do mesmo usuário que grava.
drop policy if exists "Users manage their task flag links" on public.task_flag_links;
create policy "Users manage their task flag links"
  on public.task_flag_links for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.task_flags f where f.id = flag_id and f.user_id = (select auth.uid())
    )
  );

-- 4. Limite de 5 flags por tarefa.
create or replace function public.enforce_task_flag_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.task_id::text));
  if (select count(*) from public.task_flag_links where task_id = new.task_id) >= 5 then
    raise exception 'Uma tarefa pode ter no máximo 5 flags.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists task_flag_links_limit on public.task_flag_links;
create trigger task_flag_links_limit
  before insert on public.task_flag_links
  for each row execute function public.enforce_task_flag_limit();
