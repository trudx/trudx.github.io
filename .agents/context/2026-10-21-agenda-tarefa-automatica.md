# Tarefa automática ao criar evento da agenda

## Resumo

O formulário de novo evento exige escolher uma coluna do Kanban e cria uma tarefa automaticamente ao salvar.

## Arquivos alterados

- `app/dashboard/agenda/page.tsx`
- `app/dashboard/agenda/_components/evento-form-dialog.tsx`
- `hooks/use-eventos.ts`
- `services/evento-task-service.ts`
- `tests/evento-task.test.ts`

## Alterações

- Seleção explícita da coluna, com carregamento e opção de recarregar quando não houver colunas disponíveis.
- Tarefa recebe título, descrição, local e cliente do evento; prioridade média, prazo na data local do término e estimativa baseada na duração. Eventos de dia inteiro usam 30 minutos.
- Edição de evento mantém o comportamento anterior, sem criar outra tarefa.
- Formulário bloqueado durante a gravação; sucesso informado somente após gravar evento e tarefa.
- IDs estáveis por formulário e upsert permitem repetir o envio sem duplicação. Se a tarefa falhar, tenta remover os dois registros; falhas na compensação são comunicadas explicitamente.

## Decisões

- Reutilizar as tabelas e a camada genérica de API existentes, sem alterações no banco.
- As gravações são separadas, com compensação no cliente; não existe transação atômica entre as duas requisições.
- A tarefa criada segue independente do evento após o cadastro; editar ou excluir o evento não altera a tarefa.

## Estado atual

- Oito testes do fluxo passaram, incluindo dados, data local, escolha obrigatória, falhas, compensação e IDs para novas tentativas.
- Lint dos arquivos alterados passou.
- TypeScript (`tsc --noEmit`) passou após gerar os tipos de rotas.
- Documentação local do Next.js consultada após instalar as dependências; tipos de rotas gerados com `next typegen`.

## Pendências

- Validar no navegador com uma sessão autenticada do Supabase; o checkout não contém configuração de ambiente nem credenciais para essa verificação.
