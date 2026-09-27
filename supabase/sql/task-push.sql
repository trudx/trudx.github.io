-- Additive setup for Web Push subscriptions and per-device delivery de-duplication.
-- This script creates new tables only; it does not alter existing production tables.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  timezone text not null default 'America/Sao_Paulo',
  hourly_tasks_enabled boolean not null default true,
  long_task_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.push_subscriptions from authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

drop policy if exists "Users can read their push subscriptions" on public.push_subscriptions;
create policy "Users can read their push subscriptions"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their push subscriptions" on public.push_subscriptions;
create policy "Users can create their push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their push subscriptions" on public.push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their push subscriptions" on public.push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  event_key text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  attempts smallint not null default 1 check (attempts > 0),
  last_attempt_at timestamptz not null default now(),
  retry_after timestamptz default (now() + interval '15 minutes'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_notification_events_subscription_event_key
    unique (subscription_id, event_key)
);

create index if not exists push_notification_events_created_at_idx
  on public.push_notification_events (created_at);

alter table public.push_notification_events enable row level security;
revoke all on table public.push_notification_events from public, anon, authenticated;
grant all on table public.push_notification_events to service_role;
