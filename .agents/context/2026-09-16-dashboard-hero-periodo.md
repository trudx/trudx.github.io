# Hero da visão geral com ilustração por período do dia

## Resumo

O topo do dashboard (`/dashboard`) ganhou um hero de ponta a ponta com a ilustração do período do dia (manhã, tarde, noite) ao fundo, esmaecendo para o fundo da página, com saudação, data, descrição e um botão para ligar/desligar a imagem (salvo no `localStorage`). Os indicadores financeiros ficam sobre a ilustração em cards de vidro escuro; os de tarefas ficam abaixo, em cards comuns com ícone.

## Arquivos alterados

- `app/dashboard/_components/dashboard-hero.tsx` (novo) e `index.ts`
- `app/dashboard/_components/overview-metric-card.tsx` — props `icon` e `variant` (`default` | `hero`)
- `app/dashboard/page.tsx`
- `hooks/use-dashboard-background.ts` (novo)
- `app/dashboard/_assets/manha.webp`, `tarde.webp`, `noite.webp` (novos)

## Alterações

- Período vem de `getGreetingPeriod` (`lib/greeting.ts`); madrugada usa a ilustração da noite.
- `useDashboardBackground()`: chave `trudx:dashboard-background`, padrão ligado, sincroniza entre abas (evento `storage`) e na mesma aba (evento próprio).
- Botão "Imagem de fundo" com `Switch` + `Tooltip` do shadcn (Base UI: gatilho via `render`, não `asChild`).
- Hero usa margens negativas iguais ao padding do `<main>` do layout (`-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8`) para ir de ponta a ponta; o conteúdo interno volta para `max-w-5xl`.
- Cards `hero`: `bg-zinc-950/85` + `backdrop-blur`, valores em `emerald-400`/`rose-400`, sobem 4px no hover quando clicáveis. A seta de "ver detalhes" foi para junto da dica.
- O botão "Instalar app" foi para o hero, ao lado do botão da imagem.

## Decisões

- Imagens importadas estaticamente de `app/dashboard/_assets/` em vez de `url(/manha.png)`: o export estático no GitHub Pages usa basePath, e caminho absoluto em estilo inline quebraria lá.
- Convertidas para WebP (1659px, q78) com o `sharp` que já vem com o Next, por um script avulso: ~100KB cada contra ~2MB dos PNGs. `next/image` com `placeholder="blur"`.
- Ilustração com opacidade 45% (claro) / 40% (escuro) e gradiente `from-background` na metade de baixo.

## Estado atual

`tsc --noEmit` e `npm run lint` limpos. Hero conferido no navegador por uma rota temporária (já removida), nos temas claro e escuro, com o botão ligando/desligando e persistindo. A página real não foi vista logada.

## Pendências

- `public/manha.png`, `public/tarde.png` e `public/noite.png` (~6MB) não são mais usados pelo código e continuam sendo copiados para o build — podem ser apagados se não servirem para outra coisa.
