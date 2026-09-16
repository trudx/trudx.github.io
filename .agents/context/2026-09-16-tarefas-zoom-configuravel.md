# Zoom configurável na aba Tarefas

## Resumo

No desktop, a aba Tarefas abre por padrão com escala de 75% (como um zoom negativo do navegador), para caber mais colunas do Kanban. O nível é configurável em Configurações e fica salvo no `localStorage`.

## Arquivos alterados

- `hooks/use-tasks-zoom.ts` (novo)
- `app/dashboard/settings/_components/tasks-zoom-setting.tsx` (novo) e `index.ts`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/tasks/page.tsx`

## Alterações

- `useTasksZoom()`: lê/grava a chave `trudx:tasks-zoom` via `useSyncExternalStore`; opções 50, 60, 67, 75, 80, 90 e 100%; padrão 75. Valor inválido ou storage indisponível cai no padrão.
- `useApplyTasksZoom()`: chamado na página de Tarefas; enquanto ela está montada, define `document.documentElement.style.fontSize` como a porcentagem escolhida, só com `(min-width: 48rem)`. Ao sair da página (ou ao passar para largura de celular), o `font-size` volta ao normal.
- Configurações ganhou um card "Zoom da aba Tarefas" com `Select` do shadcn.

## Decisões

- Zoom feito pelo `font-size` da raiz, não pela propriedade CSS `zoom`: o Tailwind usa `rem`, então tudo escala junto, e as coordenadas do dnd-kit (arrastar card, reordenar coluna, `DragOverlay`) continuam corretas. Com `zoom`, os transforms e a posição do overlay ficariam desalinhados do ponteiro.
- A sidebar também encolhe na aba Tarefas — é o comportamento de um zoom de navegador, como pedido.
- Media queries em `rem` usam o tamanho inicial da fonte, então os breakpoints não mudam com o zoom.
- A mudança nas Configurações dispara um evento próprio; outras abas abertas sincronizam pelo evento `storage`.

## Estado atual

`tsc --noEmit` e `npm run lint` limpos. Não foi testado no navegador logado (as rotas do dashboard exigem sessão).

## Pendências

- Conferir visualmente em 75% e em 50% com o usuário logado.

## Atualização — zoom só no corpo da página

A primeira versão reduzia o `font-size` da raiz, o que encolhia também a sidebar. Pedido: só o corpo da aba Tarefas deve escalar.

### Arquivos alterados

- `hooks/use-tasks-zoom.ts` — `useApplyTasksZoom` removido; novo `useTasksZoomScale()` devolve o fator efetivo (1 no celular).
- `app/dashboard/tasks/_components/tasks-zoom-context.ts` (novo) — `TasksZoomContext`, `useTasksZoomContext()` e `toZoomedTranslate()`.
- `app/dashboard/tasks/page.tsx`, `kanban-column.tsx`, `draggable-task-card.tsx`, `_components/index.ts`.

### Como ficou

- A página tem um container externo sem zoom com `md:h-[87vh]`; dentro dele, a `<section>` recebe `style={{ zoom }}` e usa `md:h-full`. A altura em `vh` fica fora do elemento com zoom para não ser escalada.
- Dentro de um elemento com `zoom`, um `transform` é multiplicado pelo zoom, mas o dnd-kit calcula deslocamentos em pixels de tela. Coluna e card dividem o translate pelo fator (`toZoomedTranslate`). A detecção de colisão não passa por esse ajuste, então continua correta.
- O `DragOverlay` é renderizado por portal no `body` (fora do zoom), para a posição `fixed` bater com o ponteiro; o conteúdo dele recebe o mesmo `zoom` para manter o tamanho do card.
- Diálogos e sheets já são portais do Base UI, então abrem em tamanho normal.
- Sidebar e resto do layout não mudam.

### Pendências

- Testar logado: arrastar card entre colunas e reordenar colunas em 75% e 50% (Chrome/Edge/Firefox recentes implementam o `zoom` padronizado).
