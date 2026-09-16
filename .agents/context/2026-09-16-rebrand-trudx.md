# Rebrand: izi Freelas → trudx (identidade leste europeia)

## Resumo

Produto renomeado para **trudx**, com logo de estrela e uma estrutura visual inspirada no modernismo do leste europeu: paleta preto/branco/zinc mantida, cantos retos, réguas finas, títulos condensados em caixa alta e rótulos técnicos em mono. Uma primeira versão ficou brutalista demais (réguas de 2px, hachuras, Anton) e foi suavizada a pedido do usuário.

## Arquivos alterados

- `app/globals.css` — raio zerado em toda a escala do Tailwind, `--font-display`, classe `.trudx-kicker`, regra de borda padrão movida para `@layer base`.
- `app/layout.tsx` — fonte display Oswald (400/500), metadata trudx.
- `app/manifest.ts`, `app/icon.svg` (novo), `public/icons/*.png` (regerados com a estrela), `README.md`.
- `app/_components/brand-mark.tsx` (novo), `auth-shell.tsx` (novo), `auth-brand.tsx`, `site-footer.tsx`, `landing-page.tsx`, `index.ts`.
- `app/login/page.tsx`, `app/signup/page.tsx` e os dois formulários.
- `app/dashboard/_components/dashboard-sidebar.tsx`, `app/dashboard/layout.tsx`, cabeçalhos de `page.tsx` do dashboard, clientes, tarefas, financeiro, agenda e configurações.

## Alterações

- `BrandMark`: estrela de 5 pontas (SVG), em bloco sólido (`boxed`) ou só o glifo.
- `AuthBrand` virou só o lockup (estrela + "TRUDX"); a prop `compact` foi removida.
- `AuthShell`: casca compartilhada de login/cadastro (painel escuro com título à esquerda, formulário à direita).
- Landing reorganizada em seções numeradas (Manifesto, Princípios, Procedimento, Módulos, Destinatários, Plano único, Esclarecimentos, Convocação) com grades divididas por réguas.
- Cabeçalhos do dashboard: kicker mono + título display em caixa alta + régua fina embaixo; item ativo da sidebar é bloco sólido.

## Decisões

- Paleta não mudou (pedido explícito: manter preto e branco). A identidade vem da estrutura, não de cor nova.
- Raio zerado via `--radius-*` no `@theme` — afeta todos os componentes shadcn sem editar cada um. `rounded-full` continua funcionando.
- Réguas usam `border-foreground/15` (1px); nada de 2px nem hachura — o usuário achou cansativo.
- **Bug corrigido:** `* { border-color }` estava fora de camada e vencia as utilitárias do Tailwind v4, então `border-foreground` nunca pintava. Agora fica em `@layer base`.
- Ícones PWA regerados por script Node (zlib, sem dependência nova): estrela branca sobre `#09090b`.
- A classe do calendário `.izi-calendar` e a chave `clienteapp:remember-login` não foram renomeadas (internas; renomear a chave apagaria o login salvo).

## Estado atual

Landing, login, cadastro e dashboard com a nova marca. `tsc --noEmit` e `npm run lint` limpos; landing conferida no navegador em tema claro e escuro, FAQ abrindo normalmente.

## Pendências

- `app/favicon.ico` antigo continua no repositório junto do novo `app/icon.svg`; remover se o navegador insistir no ícone antigo.
- Dashboard não foi conferido visualmente logado (as mudanças lá são só nos cabeçalhos e na sidebar).
