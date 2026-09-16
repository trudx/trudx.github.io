# Rolagem horizontal do Kanban

## Resumo

Melhorada a usabilidade da rolagem lateral das colunas na aba Tarefas: barra de rolagem fina personalizada, roda do mouse rolando para o lado, setas de navegação por coluna e esmaecimento nas bordas indicando conteúdo escondido.

## Arquivos alterados

- `hooks/use-horizontal-scroll.ts` (novo)
- `app/dashboard/tasks/_components/kanban-board.tsx`
- `app/globals.css` (classe `.trudx-scroll-x`)

## Alterações

- `useHorizontalScroll()` devolve `ref`, `canScrollLeft`, `canScrollRight`, `scrollByColumn(±1)` e `updateEdges`.
- Roda do mouse (vertical) sobre o trilho vira rolagem horizontal, **exceto** quando o ponteiro está sobre uma lista de cards que ainda pode rolar naquela direção — ao chegar no fim da lista, a roda passa a mover as colunas. Shift+roda e trackpad (delta horizontal) seguem o comportamento nativo.
- Setas (`Button` outline, só `md+`) avançam/voltam exatamente uma coluna (largura do primeiro filho + gap), com rolagem suave; somem quando não há para onde ir.
- Gradientes `from-background` nas bordas aparecem só do lado que tem colunas escondidas.
- Barra de rolagem fina (`scrollbar-width: thin`), cor `foreground` 18% em repouso e 40% no hover do trilho.
- `overscroll-x-contain` evita que o fim da rolagem lateral dispare o gesto de "voltar" do navegador.

## Decisões

- Listener de `wheel` registrado manualmente com `passive: false` (o `onWheel` do React é passivo e não permite `preventDefault`).
- Estado das bordas atualizado por `scroll`, `ResizeObserver` e mudança no número de colunas; o `setState` só troca quando algo realmente muda.
- Snap continua só no mobile; o arrasto de card para a borda continua usando o auto-scroll do dnd-kit.

## Estado atual

`tsc --noEmit` e `npm run lint` limpos. Não testado no navegador logado (o dashboard exige sessão).

## Pendências

- Validar no navegador: roda sobre coluna cheia vs. vazia, setas e esmaecimentos com o zoom de 75%.
