-- Tokens da IA por provedor, para trocar de provedor no chat sem colar a chave de novo.
-- Script aditivo: a coluna `token` continua sendo o token do provedor ativo.

alter table public.ai_configuracoes
  add column if not exists tokens jsonb not null default '{}'::jsonb;

alter table public.ai_configuracoes
  drop constraint if exists ai_configuracoes_tokens_object;
alter table public.ai_configuracoes
  add constraint ai_configuracoes_tokens_object check (jsonb_typeof(tokens) = 'object');
