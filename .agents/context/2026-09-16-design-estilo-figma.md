# Design no estilo Figma (teste)

## Resumo

Troca da linguagem visual construtivista por uma linguagem inspirada na interface do Figma: Inter em tudo, textos em caixa normal, rótulos pequenos em semibold, controles compactos, cantos levemente arredondados e sidebar no formato de painel de camadas. Paleta preto/branco/zinc mantida. A marca (trudx + estrela) continua.

## Arquivos alterados

- `app/globals.css` — `--font-sans`/`--font-display` apontam para Inter; escala de raio do Figma (2–13px); `.trudx-kicker` virou rótulo de painel (11px, 600, sem caixa alta).
- `app/layout.tsx` — Inter (`--font-inter`) no lugar de Geist Sans e Oswald; Geist Mono mantida.
- `app/dashboard/agenda/_components/calendar-theme.css` — fonte do calendário para `--font-inter`.
- `app/dashboard/layout.tsx` — sidebar de 240px com fundo `bg-card`; conteúdo com padding menor.
- `app/dashboard/_components/dashboard-sidebar.tsx` — reescrita: itens de 28px, ícones 14px, rótulo "Páginas", seleção em `bg-accent`, badge "Free".
- `app/dashboard/_components/theme-toggle.tsx` — virou item de lista compacto (sem card).
- `app/_components/landing-page.tsx`, `auth-shell.tsx`, `auth-brand.tsx`, `site-footer.tsx`, `brand-mark.tsx`.
- `app/login/*`, `app/signup/*` e cabeçalhos das páginas do dashboard (título `text-xl font-semibold`, botões `h-8 text-xs`).

## Decisões

- Conversão das classes feita por script: nos arquivos criados no rebrand saíram `uppercase`, `tracking-[0.xem]`, `font-mono` e `font-display`; nas páginas do dashboard só foram trocados os padrões inseridos no rebrand (componentes antigos com caixa alta própria ficaram como estavam).
- `font-display` continua existindo como utilitário, agora = Inter, para não quebrar usos futuros.
- Painéis escuros (hero, login/cadastro) viraram cards `rounded-2xl` com margem, em vez de blocos de ponta a ponta.
- Textos de tom "soviético" ("Seção 0X —", "Acesso — 001", "Formulário 001", "Alistamento") foram trocados por rótulos neutros.
- `BrandMark` em bloco ganhou `rounded-md` (formato de ícone de app).

## Estado atual

`tsc --noEmit` e `npm run lint` limpos. Landing e login conferidos no navegador (tema escuro). Dashboard não conferido logado.

## Pendências

- Conferir sidebar e páginas do dashboard logado.
- Se o teste for aprovado, avaliar um azul de seleção/foco no estilo Figma (hoje a paleta segue só preto e branco).
