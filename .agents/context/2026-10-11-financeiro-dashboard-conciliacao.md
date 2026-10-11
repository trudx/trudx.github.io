# Dashboard financeiro e conciliação bancária

## Resumo

A página Extrato virou um dashboard (resumo, evolução, análise de gastos, comparativos, agrupamentos, extrato) e a importação de extratos passou a **conciliar** lançamentos provisórios digitados à mão com as linhas oficiais do banco, sem duplicar valores. Saldo agora é separado em **confirmado** (âncora num saldo de extrato validado + movimentos oficiais) e **estimado** (inclui provisórios).

## Arquivos alterados

Novos:
- `supabase/sql/financeiro-conciliacao.sql` — migração (ver SQL abaixo)
- `lib/financeiro/{types,money,text,reconciliation,balance,analytics,dashboard,natureza,categorize,import-lines,ledger,format,chart-colors}.ts` — lógica pura (roda no `node --test`)
- `tests/*.test.ts` — 67 testes (`npm test`)
- `hooks/use-financeiro-{importacao,saldos,categorias,periodo}.ts`
- `_components/`: `conciliacao-review`, `conciliacao-status-badge`, `categorias-dialog`, `financeiro-resumo`, `financeiro-secao`, `financeiro-cartao`, `receitas-despesas-chart`, `saldo-evolucao-chart`, `despesas-categoria-chart`, `fixas-variaveis-card`, `maiores-despesas-card`, `comparativo-card`, `distribuicao-bancos-card`, `insights-card`, `chart-legend`, `chart-tooltip`

Alterados: `hooks/use-financeiro.ts`, `services/api-service.ts` (`offset` + `getAll`), `lib/ofx.ts`, `lib/pdf-statement.ts`, `page.tsx`, `import-ofx-dialog`, `ofx-group-card`, `financeiro-form-dialog`, `financeiro-detail-dialog`, `financeiro-grupos`, `financeiro-saldo-dialog`, `package.json` (script `test`), `tsconfig.json` (`allowImportingTsExtensions`).

Removidos: `hooks/use-financeiro-saldo.ts` e `financeiro-saldo-card.tsx` (substituídos por `use-financeiro-saldos` + `FinanceiroResumo`). A RPC antiga `financeiro_totais_por_banco` continua no banco, sem uso.

## Alterações

- **Estados**: `provisorio` / `confirmado` / `conciliado`. "Revisão necessária" é derivado (provisório com data ≤ saldo de referência do banco e sem correspondência), não armazenado.
- **Conciliação** (`lib/financeiro/reconciliation.ts`): exige mesmo banco, valor exato em centavos, mesmo sentido e data dentro da tolerância (3 dias; 5 para gasto fixo gerado pelo cron). Pontuação configurável (`MatchConfig`). Só concilia sozinho quando o par é inequívoco **nos dois sentidos** e a data é idêntica; qualquer ambiguidade ou divergência de data vai para a tela de revisão (aceitar / importar como novo mantendo o provisório / decidir depois).
- **Aplicação atômica** no Postgres: `financeiro_aplicar_importacao` (lock por usuário, revalida cada par sob `FOR UPDATE`; se o provisório já não estiver livre, a linha entra como nova) e `financeiro_desfazer_importacao` (restaura provisórios pelo histórico e remove só o que o lote criou).
- **Idempotência**: `fitid` único por usuário (já existia). OFX sem FITID ganha id determinístico por conteúdo + ocorrência. PDF já era determinístico.
- **Saldo**: RPC `financeiro_saldos(p_ate)` soma por banco; `lib/financeiro/balance.ts` combina. Sem saldo de referência o valor é rotulado "calculado" e o consolidado aparece como parcial.
- **Referência de saldo**: capturada do OFX (`LEDGERBAL`, marcada por padrão) e do PDF (último "SALDO EM", **desmarcada** se a leitura teve divergência), ou informada à mão no modal de saldos.
- **Natureza** (`normal` / `transferencia` / `pagamento_fatura` / `estorno`): transferência e pagamento de fatura ficam no extrato e no saldo do banco, mas fora de receitas/despesas; estorno abate despesa. Sugerida por palavra-chave na revisão da importação, sempre editável.
- **Categorias persistentes** (`financeiro_categorias` com `termos`): categorizam importações e, sob demanda, o histórico sem categoria.
- **Dashboard**: tudo sai de `buildDashboard` com o mesmo predicado de filtro da tabela, aplicado também ao período de comparação. Mês em andamento compara os mesmos N primeiros dias do mês anterior (e diz isso na tela).
- Gráficos usam `recharts` e `components/ui/chart` já presentes; cores do par receitas/despesas validadas para daltonismo (aqua `#1baf7a` / laranja `#eb6834`).

## Decisões

- Conciliação **nunca apaga** o provisório: ele é atualizado (data oficial, `fitid`, `dados_originais`, `conciliado_em`) e a descrição/cliente/categoria manuais são preservados. O estado anterior fica em `financeiro_historico`.
- Desfazer agora é por lote no banco (antes era `localStorage`). Importações anteriores à migração **não têm lote** e não podem mais ser desfeitas pelo botão.
- Gasto fixo gerado pelo cron nasce `provisorio` (trigger `financeiro_status_inicial`), para o débito real concilar em vez de virar segunda despesa. Linhas antigas não foram alteradas.
- O filtro de **Status** é só da tabela (revisão necessária depende do saldo de referência do banco). Os demais filtros valem para tabela, cards e gráficos. O gráfico de saldo só respeita o filtro de banco.
- Dinheiro em centavos inteiros em toda a lógica nova; a API é paginada (`getAll`) porque o PostgREST corta em 1000 linhas.

## Estado atual

- `tsc` (exceto 4 erros antigos de tipos gerados do Next), `eslint`, `prettier`/`biome`, `next build` e `npm test` (67 testes) passam.
- O SQL foi executado num Postgres real em memória (PGlite) com o schema simulado: migração duas vezes seguidas, conciliação, reimportação idempotente, provisório já consumido, saldos, desfazer + restauração, trigger e isolamento entre usuários.
- **Não validado**: a interface no navegador contra o Supabase real, e o parser de PDF com um extrato Santander real (só dados sintéticos).

## Pendências

- Rodar o SQL no Supabase **antes** do deploy (o app novo seleciona/escreve colunas novas).
- Conferir no dashboard o tipo de `financeiro.valor` (`numeric` esperado).
- Testar ponta a ponta com um PDF real do Santander e um OFX do Nubank.
- Casamento automático de transferência entre contas próprias (par Santander↔Nubank) não existe: a natureza é marcada por palavra-chave/manualmente.

## SQL (rodar no Supabase)

Arquivo único e idempotente: [`supabase/sql/financeiro-conciliacao.sql`](../../supabase/sql/financeiro-conciliacao.sql). Rode antes o bloco "0. CONFERÊNCIA" (somente leitura, comentado no topo do arquivo), depois o restante inteiro. Pré-requisitos já existentes: tabelas `bancos`, `clients`, enum `financeiro_tipo`, `unique (user_id, fitid)` em `financeiro` e a policy de update de `financeiro-update.sql`.
