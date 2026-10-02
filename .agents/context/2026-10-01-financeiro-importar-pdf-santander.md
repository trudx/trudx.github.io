# Importação de extrato em PDF (Santander)

## Resumo

O diálogo de importação do Financeiro agora aceita `.pdf` de extrato do Santander ("Extrato Consolidado Inteligente") além de `.ofx/.qfx`. O PDF vira as mesmas transações do OFX e passa pelo mesmo fluxo (agrupar, revisar, banco, checagem de duplicados).

## Arquivos alterados

- `lib/pdf-statement.ts` (novo) — leitura do PDF com `pdfjs-dist` (import dinâmico, só no cliente) e parser `parseSantanderPages`.
- `lib/ofx.ts` — agrupamento extraído para `groupTransactions`; novo `parseStatementFile(file)` (despacha por extensão e devolve `{ groups, warnings }`).
- `app/dashboard/financeiro/_components/import-ofx-dialog.tsx` — usa `parseStatementFile`, aceita `.pdf`, mostra os avisos de leitura em toast.
- `app/dashboard/financeiro/page.tsx` — botão "Importar extrato".
- `package.json` — dependência `pdfjs-dist`.

## Decisões

- Layout: linhas agrupadas por Y; colunas pela linha de cabeçalho (DATA / DESCRIÇÃO / MOVIMENTO / SALDO). A data só aparece na 1ª linha do dia (carrega pras seguintes); a linha com valor de movimento abre o lançamento e as linhas sem valor são continuação da descrição. O ano vem de "agosto/2026" no cabeçalho.
- Sinal: se o valor tiver `-`, é saída. Senão, palpite por palavra-chave (RECEBIDO/REMUNERACAO = ganho) corrigido pela conciliação com o saldo impresso (menor número de inversões que faz a soma do trecho bater). Se não bater, avisa por toast.
- Sem duplicatas: `fitid` determinístico `pdf-<hash>-<data>-<centavos>-<n>`, onde `n` é a ocorrência do mesmo lançamento dentro da mesma seção do extrato. Assim três PIX iguais de R$ 6,00 no mesmo dia continuam sendo três, mas reimportar o PDF (ou um PDF sobreposto) gera os mesmos `fitid`, barrados pelo `unique (user_id, fitid)`; a checagem por data+valor+descrição continua valendo.
- Só Santander é suportado em PDF; outro banco gera erro claro.

## Estado atual

`tsc` e eslint limpos nos arquivos tocados; `next build` compila. O parser foi testado só com dados sintéticos que imitam o layout dos prints — **não foi testado com um PDF real** (não havia nenhum no disco).

## Pendências

- Testar com um extrato PDF real e ajustar se a posição das colunas/linhas diferir.

## Desfazer último import

- `hooks/use-financeiro.ts`: `importRecords` guarda no `localStorage` (`trudx:financeiro:last-import`) os ids realmente inseridos (os ignorados por `fitid` repetido não entram); só a última importação é guardada. Novo `undoLastImport()` remove esses ids (filtrado por `user_id`) e limpa o storage; expõe `lastImportCount` e `isUndoingImport`.
- `app/dashboard/financeiro/page.tsx`: botão "Desfazer último import (N)" ao lado de "Importar extrato", só aparece se há importação para desfazer; pede confirmação e atualiza o saldo.
- Limite: o contador vive no navegador; trocar de navegador/limpar dados perde o desfazer. Lançamentos já excluídos à mão entre a importação e o desfazer ainda contam em N.

## Detalhes do lançamento

- `_components/financeiro-detail-dialog.tsx` (novo): modal com valor, data, descrição completa, tipo, cliente, banco, origem (manual / gasto fixo / OFX / PDF), ID da transação e data de cadastro; botão Excluir.
- `page.tsx`: clicar na linha da tabela abre o modal; checkbox e botão de excluir usam `stopPropagation`. "Excluir" no modal fecha o detalhe e abre o diálogo de exclusão (nunca dois `DialogRoot` empilhados).

## Filtros de origem, cliente e banco

- `page.tsx`: três `FacetedFilter` (Popover + Command com busca, reaproveitado de `tasks/_components/faceted-filter.tsx`) acima da tabela: Origem (PDF / OFX / Manual-gasto fixo, deduzida do prefixo `pdf-` do `fitid`), Cliente (+ "Sem cliente") e Banco (+ "Sem banco (avulsos)"). Multi-seleção; vazio = sem filtro. Entram no `filteredRecords`, então afetam seleção, exportação CSV e o saldo do período filtrado.

## Edição no modal de detalhes

- O modal agora edita **descrição** (input), **cliente** e **banco** (`_components/entity-combobox.tsx`, Popover + Command de seleção única, com opção "Sem cliente/banco"). Botão "Salvar alterações" só habilita quando algo mudou. Valor, data e tipo continuam imutáveis.
- `hooks/use-financeiro.ts`: `updateRecord(id, { descricao, cliente_id, banco_id })` via `patch`; se nenhuma linha voltar, dá erro explícito (sinal de policy ausente).
- **SQL obrigatório** (antes não havia policy de update em `financeiro`): `supabase/sql/financeiro-update.sql` — policy de update por dono + `grant update` só nas 3 colunas editáveis.

## Seletores de cliente só com ativos

- `hooks/use-client-list-preference.ts` (novo, `useSyncExternalStore` + `localStorage` `trudx:clients-only-active`, padrão ligado) e `settings/_components/clients-list-setting.tsx` (Switch "Listar só clientes ativos" em Configurações).
- `useClients()` passa a devolver `clients` (lista completa, para resolver nomes e filtros) e `selectableClients` (filtrada pela preferência). Os seletores de formulário usam `selectableClients`: novo lançamento, importação de extrato, modal de detalhes, formulário de tarefa, edição rápida de tarefa e evento da agenda. Filtros (Financeiro/Tarefas) continuam com todos, para poder filtrar histórico de cliente inativo.
- Limitação: se um registro já aponta para cliente inativo e a preferência está ligada, o seletor mostra "Nenhum" até trocar (o valor salvo não é alterado sem ação do usuário).
