-- Permite editar descrição, cliente e banco de um lançamento (modal de detalhes do Financeiro).
-- Só essas três colunas ficam editáveis; valor, data e tipo continuam imutáveis.
revoke update on public.financeiro from authenticated;
grant update (descricao, cliente_id, banco_id) on public.financeiro to authenticated;

create policy "Financeiro is updatable by owner"
  on public.financeiro for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
