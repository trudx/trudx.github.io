-- Rodar UMA vez no SQL Editor do Supabase. É idempotente: pode repetir sem efeito colateral.
--  1. Importação de extrato em CSV (amplia o formato aceito em financeiro_importacoes).
--  2. Configuração da IA (provedor, modelo e token) por usuário, compartilhada entre dispositivos.
--  3. Conversas com a IA por usuário, compartilhadas entre dispositivos.

-- 1. CSV ------------------------------------------------------------------------------------------
alter table public.financeiro_importacoes
  drop constraint if exists financeiro_importacoes_formato_check;

alter table public.financeiro_importacoes
  add constraint financeiro_importacoes_formato_check
  check (formato in ('ofx', 'pdf', 'csv'));

-- 2. Configuração da IA ---------------------------------------------------------------------------
-- O token fica em texto puro: a proteção é a RLS (só o dono lê e grava a própria linha).
create table if not exists public.ai_configuracoes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  token text not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_configuracoes enable row level security;

drop policy if exists "AI config is viewable by owner" on public.ai_configuracoes;
create policy "AI config is viewable by owner" on public.ai_configuracoes
  for select using (auth.uid() = user_id);

drop policy if exists "AI config is insertable by owner" on public.ai_configuracoes;
create policy "AI config is insertable by owner" on public.ai_configuracoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "AI config is updatable by owner" on public.ai_configuracoes;
create policy "AI config is updatable by owner" on public.ai_configuracoes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "AI config is deletable by owner" on public.ai_configuracoes;
create policy "AI config is deletable by owner" on public.ai_configuracoes
  for delete using (auth.uid() = user_id);

-- 3. Conversas com a IA ---------------------------------------------------------------------------
create table if not exists public.ai_conversas (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null default 'Conversa',
  entradas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversas_user_updated_idx
  on public.ai_conversas (user_id, updated_at desc);

alter table public.ai_conversas enable row level security;

drop policy if exists "AI chats are viewable by owner" on public.ai_conversas;
create policy "AI chats are viewable by owner" on public.ai_conversas
  for select using (auth.uid() = user_id);

drop policy if exists "AI chats are insertable by owner" on public.ai_conversas;
create policy "AI chats are insertable by owner" on public.ai_conversas
  for insert with check (auth.uid() = user_id);

drop policy if exists "AI chats are updatable by owner" on public.ai_conversas;
create policy "AI chats are updatable by owner" on public.ai_conversas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "AI chats are deletable by owner" on public.ai_conversas;
create policy "AI chats are deletable by owner" on public.ai_conversas
  for delete using (auth.uid() = user_id);
