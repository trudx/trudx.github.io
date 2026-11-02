-- Saúde de sistemas: sai do localStorage e passa a ser salva por usuário.
-- Script aditivo: cria uma tabela nova; não altera nem apaga dados existentes.

create table if not exists public.system_health_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  url text not null check (url ~* '^https?://'),
  -- Início da sequência atual de respostas 200; volta a null quando o sistema falha.
  calculation_started_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_health_systems_user_url_key unique (user_id, url)
);

alter table public.system_health_systems enable row level security;
revoke all on table public.system_health_systems from anon;
grant select, insert, update, delete on table public.system_health_systems to authenticated;

drop policy if exists "Users manage their health systems" on public.system_health_systems;
create policy "Users manage their health systems"
  on public.system_health_systems for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_system_health_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists system_health_systems_updated_at on public.system_health_systems;
create trigger system_health_systems_updated_at
  before update on public.system_health_systems
  for each row execute function public.set_system_health_updated_at();
