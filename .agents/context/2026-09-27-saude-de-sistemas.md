# Saúde de sistemas e edição direta das tarefas

## Resumo

Adicionada a aba Saúde de sistemas ao dashboard, com cadastro local de URLs de verificação e
contagem de dias online. Os cards do Kanban também abrem a edição completa ao clicar no corpo.

## Arquivos alterados

- `hooks/use-system-health.ts` (novo)
- `lib/system-health.ts` (novo)
- `app/dashboard/system-health/page.tsx` (novo)
- `app/dashboard/system-health/_components/system-health-form-dialog.tsx` (novo)
- `app/dashboard/system-health/_components/system-health-delete-dialog.tsx` (novo)
- `app/dashboard/system-health/_components/index.ts` (novo)
- `app/dashboard/_components/dashboard-sidebar.tsx`
- `app/dashboard/tasks/_components/task-card.tsx`

## Alterações

- Sistemas, URL, data de cadastro, início da contagem e última checagem válida ficam no
  `localStorage` (`trudx:system-health:v1`), sem tabela ou escrita no Supabase.
- Ao abrir a aba, cada URL recebe um GET sem credenciais, sem cache, sem seguir redirecionamentos e
  com timeout de 10 segundos. Só HTTP 200 direto é considerado online.
- Resposta diferente de 200, timeout, erro de rede ou bloqueio de CORS define o sistema como offline
  e apaga `calculationStartedAt` e `lastCheckedAt`. O próximo HTTP 200 inicia outra contagem.
- A tela explica que o check só roda ao abrir ou recarregar, e que a rota precisa ser pública, aceitar
  CORS do domínio do app e usar HTTPS quando o app também usa HTTPS.
- Alterar uma URL reinicia a contagem e dispara uma verificação para a nova rota. Editar o nome não
  altera as datas. Cadastro verifica a URL imediatamente.
- Clique no corpo de um card de tarefa abre o formulário completo; cliques em botões e links internos
  continuam executando suas ações.
- Exporta JSON versionado com nomes e URLs, sem datas de uptime. A importação valida o formato,
  mescla sem sobrescrever e ignora URLs já cadastradas; as novas configurações recebem um check e
  começam uma nova contagem quando responderem HTTP 200.
- A página mostra um aviso de que as configurações são locais e oferece botões de exportar/importar.
- Corrigidos os nomes dos componentes do diálogo de confirmação para corresponder às exportações
  `AlertDialogRoot`, `AlertDialogContent` e demais componentes de `components/ui/alert-dialog.tsx`.

## Decisões

- A verificação roda no navegador porque o projeto usa `output: "export"` e não tem backend próprio.
  A documentação do Next orienta acessar APIs do navegador dentro de efeitos de Client Components.
- O contador mede tempo desde a primeira resposta 200 da sequência observada. Como não existe check em
  segundo plano, a tela deixa explícito que a consulta depende de abrir ou recarregar a aba.
- `redirect: "manual"` evita contar como online um endpoint protegido que redireciona para uma página
  de login que responde 200.

## Estado atual

Implementação concluída. Não foi executada validação automatizada nesta sessão: `node_modules` não
está instalado neste checkout.

## Pendências

- Conferir no navegador o cadastro, o ciclo 200 → falha → novo 200 e o clique no card de tarefa.
- Confirmar que as URLs usadas em produção permitem CORS para o domínio do app.
