-- MCP remoto de tarefas: token de acesso por usuário e log das requisições feitas pelas IAs.
-- Script aditivo: cria tabelas e funções novas; não altera nem apaga dados existentes.
-- Depois de rodar, publique a função: supabase functions deploy mcp

-- 1. Token: um por usuário. Gerar outro substitui o anterior, que deixa de valer na hora.
--    Fica legível só pelo dono (RLS), para o painel poder mostrar e copiar de novo.
create table if not exists public.mcp_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique check (token ~ '^trudx_[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.mcp_tokens enable row level security;
revoke all on table public.mcp_tokens from public, anon, authenticated;
-- Sem insert/update direto: o token só nasce pela função abaixo, que garante a aleatoriedade.
grant select, delete on table public.mcp_tokens to authenticated;
grant all on table public.mcp_tokens to service_role;

drop policy if exists "Users read their MCP token" on public.mcp_tokens;
create policy "Users read their MCP token"
  on public.mcp_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users revoke their MCP token" on public.mcp_tokens;
create policy "Users revoke their MCP token"
  on public.mcp_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Dois UUID v4 sem hífen = 244 bits aleatórios, sem depender do pgcrypto.
create or replace function public.mcp_regenerate_token()
returns public.mcp_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.mcp_tokens;
begin
  if v_user_id is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '28000';
  end if;

  insert into public.mcp_tokens (user_id, token, created_at)
  values (
    v_user_id,
    'trudx_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    now()
  )
  on conflict (user_id) do update
    set token = excluded.token, created_at = excluded.created_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.mcp_regenerate_token() from public, anon;
grant execute on function public.mcp_regenerate_token() to authenticated;

-- 2. Log de cada requisição JSON-RPC recebida pelo MCP. Só a função (service_role) grava;
--    o dono lê e pode limpar.
create table if not exists public.mcp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- IA que fez a chamada, como ela mesma se declarou no argumento `ia` (claude, chatgpt...).
  agent text,
  agent_model text,
  -- Cliente MCP informado no `initialize` (ex.: claude-code, openai-mcp).
  client_name text,
  client_version text,
  session_id uuid,
  method text not null,
  tool text,
  arguments jsonb,
  result jsonb,
  status text not null check (status in ('ok', 'error')),
  error text,
  duration_ms integer not null default 0,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_logs_user_created_idx
  on public.mcp_logs (user_id, created_at desc, id desc);
create index if not exists mcp_logs_session_idx
  on public.mcp_logs (session_id)
  where session_id is not null;

alter table public.mcp_logs enable row level security;
revoke all on table public.mcp_logs from public, anon, authenticated;
grant select, delete on table public.mcp_logs to authenticated;
grant all on table public.mcp_logs to service_role;

drop policy if exists "Users read their MCP logs" on public.mcp_logs;
create policy "Users read their MCP logs"
  on public.mcp_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users clear their MCP logs" on public.mcp_logs;
create policy "Users clear their MCP logs"
  on public.mcp_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Resumo da aba: chamadas e erros por IA, sem trazer as linhas para o navegador.
create or replace function public.mcp_logs_resumo()
returns table (agent text, total bigint, erros bigint, ultima_chamada timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(l.agent, 'não informado'),
    count(*),
    count(*) filter (where l.status = 'error'),
    max(l.created_at)
  from public.mcp_logs l
  where l.user_id = (select auth.uid())
  group by 1
  order by 2 desc;
$$;

revoke all on function public.mcp_logs_resumo() from public, anon;
grant execute on function public.mcp_logs_resumo() to authenticated;
