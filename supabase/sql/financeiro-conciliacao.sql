-- =====================================================================================
-- Financeiro: lançamentos provisórios, conciliação bancária, saldos de referência,
-- categorias e natureza (transferência / fatura / estorno).
--
-- COMO APLICAR (produção):
--   1. Rode primeiro o bloco "0. CONFERÊNCIA" sozinho (só leitura) e me passe o resultado.
--   2. Rode o restante inteiro de uma vez (SQL Editor do Supabase). É tudo aditivo:
--      colunas novas têm DEFAULT, nada é apagado, o app atual continua funcionando.
--   3. Só depois publique o código novo (push na main).
--
-- Tudo é idempotente (if not exists / create or replace / drop ... if exists):
-- pode rodar de novo sem efeito colateral.
-- =====================================================================================


-- =====================================================================================
-- 0. CONFERÊNCIA (somente leitura — rode antes e confirme)
-- =====================================================================================
-- select column_name, data_type, numeric_precision, numeric_scale
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'financeiro' order by ordinal_position;
--
-- select indexdef from pg_indexes where schemaname = 'public' and tablename = 'financeiro';
--
-- (precisa existir um índice UNIQUE em (user_id, fitid); o ON CONFLICT abaixo depende dele)
-- (se `valor` for double precision em vez de numeric, me avise: o app arredonda para
--  centavos, mas vale migrar para numeric(14,2).)


-- =====================================================================================
-- 1. TABELAS NOVAS
-- =====================================================================================

-- Um registro por importação de extrato (lote). É o que permite desfazer com segurança.
create table if not exists public.financeiro_importacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  banco_id uuid references public.bancos (id) on delete set null,
  arquivo text,
  formato text check (formato in ('ofx', 'pdf')),
  periodo_inicio date,
  periodo_fim date,
  total_linhas integer not null default 0,
  inseridas integer not null default 0,
  conciliadas integer not null default 0,
  ignoradas integer not null default 0,
  created_at timestamptz not null default now(),
  desfeita_em timestamptz
);

create index if not exists financeiro_importacoes_user_idx
  on public.financeiro_importacoes (user_id, created_at desc);

-- Histórico de alterações feitas pela conciliação (estado antes/depois).
create table if not exists public.financeiro_historico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financeiro_id uuid not null,
  lote_id uuid references public.financeiro_importacoes (id) on delete set null,
  acao text not null check (acao in ('conciliado', 'revertido')),
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financeiro_historico_lote_idx
  on public.financeiro_historico (lote_id);
create index if not exists financeiro_historico_lancamento_idx
  on public.financeiro_historico (financeiro_id);

-- Saldo bancário validado (fim de extrato ou conferido à mão). Âncora do "saldo confirmado".
create table if not exists public.financeiro_saldos_referencia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  banco_id uuid not null references public.bancos (id) on delete cascade,
  data date not null,
  saldo numeric(14, 2) not null,
  origem text not null check (origem in ('pdf', 'ofx', 'manual')),
  lote_id uuid references public.financeiro_importacoes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, banco_id, data)
);

-- Categorias persistentes. `termos` permite categorizar por palavra-chave (importação e "aplicar regras").
create table if not exists public.financeiro_categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) > 0),
  termos text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);


-- =====================================================================================
-- 2. COLUNAS NOVAS EM public.financeiro (todas com DEFAULT: linhas existentes ficam como estão)
-- =====================================================================================
alter table public.financeiro
  add column if not exists status text not null default 'confirmado'
    check (status in ('provisorio', 'confirmado', 'conciliado')),
  add column if not exists natureza text not null default 'normal'
    check (natureza in ('normal', 'transferencia', 'pagamento_fatura', 'estorno')),
  add column if not exists categoria_id uuid references public.financeiro_categorias (id) on delete set null,
  add column if not exists lote_id uuid references public.financeiro_importacoes (id) on delete set null,
  add column if not exists conciliado_em timestamptz,
  add column if not exists dados_originais jsonb;

create index if not exists financeiro_user_banco_data_idx
  on public.financeiro (user_id, banco_id, data);
create index if not exists financeiro_user_status_idx
  on public.financeiro (user_id, status) where status = 'provisorio';
create index if not exists financeiro_lote_idx
  on public.financeiro (lote_id) where lote_id is not null;

-- Gasto fixo gerado pelo cron nasce provisório: quando o débito real chegar no extrato ele é
-- conciliado em vez de virar uma segunda despesa. Não depende de alterar a função do cron.
-- Linhas antigas NÃO são alteradas.
create or replace function public.financeiro_status_inicial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'gasto_fixo' and new.gasto_fixo_id is not null and new.fitid is null
     and new.status = 'confirmado' then
    new.status := 'provisorio';
  end if;
  return new;
end;
$$;

drop trigger if exists financeiro_status_inicial on public.financeiro;
create trigger financeiro_status_inicial
  before insert on public.financeiro
  for each row execute function public.financeiro_status_inicial();


-- =====================================================================================
-- 3. RLS E PERMISSÕES
-- =====================================================================================
alter table public.financeiro_importacoes enable row level security;
alter table public.financeiro_historico enable row level security;
alter table public.financeiro_saldos_referencia enable row level security;
alter table public.financeiro_categorias enable row level security;

drop policy if exists "Importacoes are viewable by owner" on public.financeiro_importacoes;
create policy "Importacoes are viewable by owner" on public.financeiro_importacoes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Historico is viewable by owner" on public.financeiro_historico;
create policy "Historico is viewable by owner" on public.financeiro_historico
  for select to authenticated using (user_id = auth.uid());

-- Lotes e histórico só são escritos pelas funções abaixo (security definer), nunca direto.
revoke insert, update, delete on public.financeiro_importacoes from authenticated, anon;
revoke insert, update, delete on public.financeiro_historico from authenticated, anon;

drop policy if exists "Saldos are viewable by owner" on public.financeiro_saldos_referencia;
create policy "Saldos are viewable by owner" on public.financeiro_saldos_referencia
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Saldos are insertable by owner" on public.financeiro_saldos_referencia;
create policy "Saldos are insertable by owner" on public.financeiro_saldos_referencia
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Saldos are updatable by owner" on public.financeiro_saldos_referencia;
create policy "Saldos are updatable by owner" on public.financeiro_saldos_referencia
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Saldos are deletable by owner" on public.financeiro_saldos_referencia;
create policy "Saldos are deletable by owner" on public.financeiro_saldos_referencia
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Categorias are viewable by owner" on public.financeiro_categorias;
create policy "Categorias are viewable by owner" on public.financeiro_categorias
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Categorias are insertable by owner" on public.financeiro_categorias;
create policy "Categorias are insertable by owner" on public.financeiro_categorias
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Categorias are updatable by owner" on public.financeiro_categorias;
create policy "Categorias are updatable by owner" on public.financeiro_categorias
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Categorias are deletable by owner" on public.financeiro_categorias;
create policy "Categorias are deletable by owner" on public.financeiro_categorias
  for delete to authenticated using (user_id = auth.uid());

-- Colunas editáveis do lançamento (a policy de update por dono já existe em financeiro-update.sql).
-- valor, data e tipo continuam imutáveis; status/fitid/lote só mudam pela conciliação.
grant update (categoria_id, natureza, status) on public.financeiro to authenticated;


-- =====================================================================================
-- 4. SALDOS POR BANCO (confirmado × estimado) — só soma; as regras de exibição ficam no app
-- =====================================================================================
drop function if exists public.financeiro_saldos(date);

create function public.financeiro_saldos(p_ate date default null)
returns table (
  banco_id uuid,
  ref_data date,
  ref_saldo numeric,
  mov_oficial numeric,
  mov_total numeric,
  total numeric,
  provisorios_qtd integer,
  provisorios_valor numeric,
  provisorios_obsoletos_qtd integer,
  ultima_cobertura date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date) as ate
  ),
  base as (
    select f.banco_id, f.data, f.fitid, f.status,
           case when f.tipo = 'ganho' then f.valor else -f.valor end as signed
    from public.financeiro f, params
    where f.user_id = auth.uid() and f.data <= params.ate
  ),
  ref as (
    select distinct on (r.banco_id) r.banco_id, r.data, r.saldo
    from public.financeiro_saldos_referencia r, params
    where r.user_id = auth.uid() and r.data <= params.ate
    order by r.banco_id, r.data desc
  ),
  cobertura as (
    select i.banco_id, max(i.periodo_fim) as fim
    from public.financeiro_importacoes i
    where i.user_id = auth.uid() and i.desfeita_em is null
    group by i.banco_id
  ),
  bancos as (
    select b.banco_id from base b
    union
    select r.banco_id from ref r
  )
  select
    bk.banco_id,
    r.data,
    r.saldo,
    coalesce((select sum(b.signed) from base b
              where b.banco_id is not distinct from bk.banco_id
                and r.data is not null and b.fitid is not null and b.data > r.data), 0),
    coalesce((select sum(b.signed) from base b
              where b.banco_id is not distinct from bk.banco_id
                and r.data is not null and b.data > r.data), 0),
    coalesce((select sum(b.signed) from base b
              where b.banco_id is not distinct from bk.banco_id), 0),
    (select count(*) from base b
      where b.banco_id is not distinct from bk.banco_id and b.status = 'provisorio')::integer,
    coalesce((select sum(b.signed) from base b
              where b.banco_id is not distinct from bk.banco_id and b.status = 'provisorio'
                and (r.data is null or b.data > r.data)), 0),
    (select count(*) from base b
      where b.banco_id is not distinct from bk.banco_id and b.status = 'provisorio'
        and r.data is not null and b.data <= r.data)::integer,
    coalesce(c.fim, (select max(b.data) from base b
                     where b.banco_id is not distinct from bk.banco_id and b.fitid is not null))
  from bancos bk
  left join ref r on r.banco_id = bk.banco_id
  left join cobertura c on c.banco_id = bk.banco_id;
$$;

revoke all on function public.financeiro_saldos(date) from public, anon;
grant execute on function public.financeiro_saldos(date) to authenticated;


-- =====================================================================================
-- 5. APLICAR IMPORTAÇÃO (atômico): lote + conciliações + lançamentos novos + saldo de referência
--
-- O app calcula o plano (quem concilia com quem) e envia pronto. A função revalida TUDO sob
-- lock: se um provisório já não estiver livre (outra aba, outra importação), aquela linha do
-- extrato entra como lançamento novo em vez de falhar ou duplicar.
-- p_conciliacoes: [{id, data, valor, tipo, descricao, fitid, natureza?, cliente_id?, categoria_id?}]
-- p_novas:        [{data, valor, tipo, descricao, fitid, natureza?, cliente_id?, categoria_id?}]
-- =====================================================================================
drop function if exists public.financeiro_aplicar_importacao(uuid, text, text, date, date, date, numeric, jsonb, jsonb);

create function public.financeiro_aplicar_importacao(
  p_banco_id uuid,
  p_arquivo text,
  p_formato text,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_saldo_data date,
  p_saldo numeric,
  p_novas jsonb,
  p_conciliacoes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lote uuid;
  v_item jsonb;
  v_row public.financeiro%rowtype;
  v_extra jsonb := '[]'::jsonb;
  v_novas jsonb := coalesce(p_novas, '[]'::jsonb);
  v_conciliacoes jsonb := coalesce(p_conciliacoes, '[]'::jsonb);
  v_total integer;
  v_conciliadas integer := 0;
  v_inseridas integer := 0;
  v_tentadas integer;
  v_saldo_novo integer := 0;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Uma importação por vez por usuário: impede duas conciliações concorrentes sobre o mesmo provisório.
  perform pg_advisory_xact_lock(hashtextextended('financeiro:' || v_user::text, 0));

  if p_banco_id is not null and not exists (
    select 1 from public.bancos where id = p_banco_id and user_id = v_user
  ) then
    raise exception 'Banco inválido';
  end if;

  v_total := jsonb_array_length(v_novas) + jsonb_array_length(v_conciliacoes);

  insert into public.financeiro_importacoes
    (user_id, banco_id, arquivo, formato, periodo_inicio, periodo_fim, total_linhas)
  values
    (v_user, p_banco_id, p_arquivo, p_formato, p_periodo_inicio, p_periodo_fim, v_total)
  returning id into v_lote;

  -- Conciliações: só aplica se o provisório ainda estiver livre e todos os critérios batem.
  for v_item in select * from jsonb_array_elements(v_conciliacoes) loop
    select * into v_row
      from public.financeiro
     where id = (v_item->>'id')::uuid and user_id = v_user
       for update;

    if found
       and v_row.status = 'provisorio'
       and v_row.fitid is null
       and v_row.banco_id is not distinct from p_banco_id
       and v_row.valor = (v_item->>'valor')::numeric
       and ((v_row.tipo = 'ganho') = ((v_item->>'tipo') = 'ganho'))
       and not exists (
         select 1 from public.financeiro where user_id = v_user and fitid = v_item->>'fitid'
       )
    then
      update public.financeiro
         set data = (v_item->>'data')::date,
             fitid = v_item->>'fitid',
             status = 'conciliado',
             conciliado_em = now(),
             lote_id = v_lote,
             dados_originais = jsonb_build_object(
               'data', v_item->>'data',
               'descricao', v_item->>'descricao',
               'valor', (v_item->>'valor')::numeric,
               'tipo', v_item->>'tipo',
               'fitid', v_item->>'fitid'
             )
       where id = v_row.id;

      insert into public.financeiro_historico (user_id, financeiro_id, lote_id, acao, antes, depois)
      values (
        v_user, v_row.id, v_lote, 'conciliado',
        jsonb_build_object(
          'data', v_row.data, 'status', v_row.status, 'fitid', v_row.fitid,
          'lote_id', v_row.lote_id, 'conciliado_em', v_row.conciliado_em,
          'dados_originais', v_row.dados_originais
        ),
        jsonb_build_object(
          'data', v_item->>'data', 'status', 'conciliado', 'fitid', v_item->>'fitid',
          'lote_id', v_lote
        )
      );
      v_conciliadas := v_conciliadas + 1;
    else
      -- Não foi possível conciliar (provisório mudou/sumiu): a linha do extrato é real e entra como nova.
      v_extra := v_extra || jsonb_build_array(v_item);
    end if;
  end loop;

  v_tentadas := jsonb_array_length(v_novas) + jsonb_array_length(v_extra);

  with ins as (
    insert into public.financeiro
      (user_id, data, tipo, valor, descricao, cliente_id, banco_id, fitid, natureza,
       categoria_id, status, lote_id)
    select
      v_user,
      (n->>'data')::date,
      (n->>'tipo')::public.financeiro_tipo,
      (n->>'valor')::numeric,
      nullif(trim(n->>'descricao'), ''),
      (select c.id from public.clients c
        where c.id = nullif(n->>'cliente_id', '')::uuid and c.user_id = v_user),
      p_banco_id,
      n->>'fitid',
      coalesce(nullif(n->>'natureza', ''), 'normal'),
      (select k.id from public.financeiro_categorias k
        where k.id = nullif(n->>'categoria_id', '')::uuid and k.user_id = v_user),
      'confirmado',
      v_lote
    from jsonb_array_elements(v_novas || v_extra) as n
    on conflict (user_id, fitid) do nothing
    returning 1
  )
  select count(*)::integer into v_inseridas from ins;

  if p_saldo_data is not null and p_saldo is not null and p_banco_id is not null then
    insert into public.financeiro_saldos_referencia
      (user_id, banco_id, data, saldo, origem, lote_id)
    values (v_user, p_banco_id, p_saldo_data, p_saldo, coalesce(p_formato, 'manual'), v_lote)
    on conflict (user_id, banco_id, data) do nothing;
    get diagnostics v_saldo_novo = row_count;
  end if;

  -- Reimportar um arquivo já importado não muda nada: não deixa um lote vazio como "último import".
  if v_inseridas = 0 and v_conciliadas = 0 and v_saldo_novo = 0 then
    delete from public.financeiro_importacoes where id = v_lote;
    return jsonb_build_object(
      'lote_id', null, 'inseridas', 0, 'conciliadas', 0, 'ignoradas', v_tentadas
    );
  end if;

  update public.financeiro_importacoes
     set inseridas = v_inseridas,
         conciliadas = v_conciliadas,
         ignoradas = v_tentadas - v_inseridas
   where id = v_lote;

  return jsonb_build_object(
    'lote_id', v_lote,
    'inseridas', v_inseridas,
    'conciliadas', v_conciliadas,
    'ignoradas', v_tentadas - v_inseridas
  );
end;
$$;

revoke all on function public.financeiro_aplicar_importacao(uuid, text, text, date, date, date, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.financeiro_aplicar_importacao(uuid, text, text, date, date, date, numeric, jsonb, jsonb) to authenticated;


-- =====================================================================================
-- 6. DESFAZER IMPORTAÇÃO (atômico)
--   * lançamentos criados pelo lote são removidos;
--   * provisórios conciliados pelo lote voltam EXATAMENTE ao estado anterior (data, sem fitid,
--     status provisório) — nada manual é apagado;
--   * saldo de referência criado pelo lote é removido.
-- =====================================================================================
drop function if exists public.financeiro_desfazer_importacao(uuid);

create function public.financeiro_desfazer_importacao(p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lote public.financeiro_importacoes%rowtype;
  v_hist public.financeiro_historico%rowtype;
  v_restauradas integer := 0;
  v_removidas integer := 0;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('financeiro:' || v_user::text, 0));

  select * into v_lote
    from public.financeiro_importacoes
   where id = p_lote and user_id = v_user
     for update;

  if not found then
    raise exception 'Importação não encontrada';
  end if;
  if v_lote.desfeita_em is not null then
    raise exception 'Essa importação já foi desfeita';
  end if;

  for v_hist in
    select * from public.financeiro_historico
     where lote_id = p_lote and user_id = v_user and acao = 'conciliado'
  loop
    update public.financeiro
       set data = (v_hist.antes->>'data')::date,
           status = v_hist.antes->>'status',
           fitid = v_hist.antes->>'fitid',
           lote_id = nullif(v_hist.antes->>'lote_id', '')::uuid,
           conciliado_em = nullif(v_hist.antes->>'conciliado_em', '')::timestamptz,
           dados_originais = nullif(v_hist.antes->'dados_originais', 'null'::jsonb)
     where id = v_hist.financeiro_id and user_id = v_user and lote_id = p_lote;

    if found then
      insert into public.financeiro_historico (user_id, financeiro_id, lote_id, acao, antes, depois)
      values (v_user, v_hist.financeiro_id, p_lote, 'revertido', v_hist.depois, v_hist.antes);
      v_restauradas := v_restauradas + 1;
    end if;
  end loop;

  -- Depois da restauração, o que ainda aponta para o lote como 'confirmado' foi criado por ele.
  delete from public.financeiro
   where user_id = v_user and lote_id = p_lote and status = 'confirmado';
  get diagnostics v_removidas = row_count;

  delete from public.financeiro_saldos_referencia
   where user_id = v_user and lote_id = p_lote;

  update public.financeiro_importacoes set desfeita_em = now() where id = p_lote;

  return jsonb_build_object('restauradas', v_restauradas, 'removidas', v_removidas);
end;
$$;

revoke all on function public.financeiro_desfazer_importacao(uuid) from public, anon;
grant execute on function public.financeiro_desfazer_importacao(uuid) to authenticated;
