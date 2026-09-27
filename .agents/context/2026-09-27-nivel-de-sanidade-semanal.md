# Níveis de sanidade nas tarefas

## Resumo

A área de resumo de tempo da aba Tarefas agora inclui níveis de sanidade com barras para hoje, a
semana e o mês. A classificação é derivada dos segundos que o cronômetro já contabiliza; não exige
tabela, migração ou nova chamada ao Supabase.

## Arquivos alterados

- `app/dashboard/tasks/_components/task-sanity-level.tsx` (novo) — cartões de período, barras, faixas e mensagens.
- `app/dashboard/tasks/_components/task-time-summary.tsx` — exibe os três níveis, ajusta as faixas aos
  dias úteis corridos e renova os totais na virada de dia.
- `app/dashboard/tasks/page.tsx` — passa a função de atualização dos totais ao resumo.

## Decisões

- Os três indicadores usam as mesmas faixas médias: até 6h por dia = Ótimo; acima de 6h até 8h =
  Padrão; acima de 8h até 10h = Superávit; acima de 10h = Insano.
- Hoje usa o total diário. Semana e mês multiplicam as faixas de 6/8/10h pelos dias de segunda a
  sexta já transcorridos no período. Feriados não têm calendário próprio e contam como dia útil.
- Cada barra vai até o limite Superávit; acima dele continua cheia e mostra o rótulo Insano.
- Sem tempo registrado, mostra “Sem registros” em vez de classificar zero como ótimo.
- Reusa os totais diários, semanais e mensais e o segundo extra do cronômetro em execução; os três
  indicadores atualizam ao vivo sem renderizar a página Kanban inteira. Ao virar o dia, os totais
  são buscados novamente para acompanhar a nova data local.

## Estado atual

Implementação feita. Não foram executados build ou testes nesta sessão.
