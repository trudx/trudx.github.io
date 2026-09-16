# Modo privacidade na aba Financeiro

## Resumo

Ao abrir a aba Financeiro, todos os valores em reais aparecem como `R$ ••••`. Um botão com ícone de olho no cabeçalho ("Valores ocultos" / "Valores visíveis") mostra ou esconde os valores de uma vez, incluindo os dialogs.

## Arquivos alterados

- `app/dashboard/financeiro/_components/financeiro-privacy.ts` (novo) — `FinanceiroPrivacyContext`, `useFinanceiroPrivacy()`, `formatCurrencyPrivate()`, `MASKED_VALUE`.
- `app/dashboard/financeiro/_components/privacy-toggle.tsx` (novo) — botão com `Eye`/`EyeOff` e tooltip.
- `app/dashboard/financeiro/_components/index.ts`
- `app/dashboard/financeiro/page.tsx` — estado `isValoresHidden` (começa `true`), provider em volta da página, botão no cabeçalho, saldo do período e coluna de valor da tabela mascarados.
- `financeiro-saldo-card.tsx`, `financeiro-saldo-dialog.tsx`, `financeiro-grupos.tsx`, `financeiro-grupo-dialog.tsx`, `gastos-fixos-dialog.tsx`, `import-ofx-dialog.tsx`, `ofx-group-card.tsx` — `formatCurrency` trocado por `formatValor` do hook.

## Decisões

- Estado em memória na página, sem `localStorage`: a cada abertura da aba os valores voltam a ficar ocultos, que é o objetivo (proteger quando a tela é aberta perto de outras pessoas).
- Dialogs leem o mesmo contexto (portais preservam o contexto do React), então um único botão controla tudo.
- Com os valores ocultos, saldos negativos não ficam vermelhos — a cor entregaria o sinal. As cores fixas de ganho (verde) e saída (vermelho) continuam, porque não revelam valor.
- O contexto tem padrão "visível": componentes usados fora da página continuam mostrando valores.
- Campos de formulário (novo lançamento, gasto fixo) não são mascarados — o usuário está digitando o valor.
- `page.tsx` teve reindentação completa por causa do provider em volta da `<section>`.

## Estado atual

`tsc --noEmit` e `npm run lint` limpos. Card de saldo + botão conferidos no navegador por uma rota temporária (já removida): começa com `R$ ••••`, o clique revela os valores. A página real não foi vista logada.

## Pendências

- A busca por valor da tabela ainda funciona com valores ocultos (filtrar por "50" revela quais linhas têm esse valor).
- O dashboard (visão geral) continua mostrando ganhos e gastos sem máscara.
