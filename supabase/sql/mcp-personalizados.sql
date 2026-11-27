begin;

create table if not exists public.mcp_custom_servers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  url text not null check (url ~ '^https://' and char_length(url) <= 2048),
  headers jsonb not null default '{}'::jsonb check (
    jsonb_typeof(headers) = 'object' and octet_length(headers::text) <= 8192
  ),
  enabled_tools text[] not null default '{}' check (cardinality(enabled_tools) <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.mcp_custom_servers enable row level security;
revoke all on table public.mcp_custom_servers from public, anon, authenticated;
grant select, insert, update, delete on table public.mcp_custom_servers to authenticated;

drop policy if exists "Users manage their MCP servers" on public.mcp_custom_servers;
create policy "Users manage their MCP servers"
  on public.mcp_custom_servers for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
