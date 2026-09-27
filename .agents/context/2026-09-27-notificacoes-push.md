# Notificações push de tarefas

## Implementado no repositório

- A PWA usa o service worker existente em `public/sw.js`, que agora recebe push, exibe a notificação e abre a aba Tarefas ao clicar. A versão do cache foi atualizada e a ativação só limpa caches antigos `izi-freelas-*`.
- Configurações > Notificações permite ativar/desativar por dispositivo e escolher lembretes horários e pausas. O pedido de permissão do navegador ocorre pelo botão.
- A assinatura Web Push é armazenada em `public.push_subscriptions`, protegida por RLS por usuário. O endpoint e a chave de autenticação do PushSubscription são dados sensíveis.
- A Edge Function `dispatch-task-notifications` envia lembretes de tarefas previstas para hoje, das 9h às 18h no fuso do dispositivo, e aviso após três horas com um cronômetro ativo.
- `push_notification_events` faz deduplicação por assinatura e evento e segura novas tentativas por 15 minutos (máximo de 10 tentativas). Assinaturas expiradas são removidas; endpoints que não sejam HTTPS dos serviços de push suportados são rejeitados.
- Conclusão de tarefa é inferida pelo nome da coluna (Concluído/Finalizado/Feito/Done/Complete), pois o schema atual não tem campo explícito de conclusão.

## Ainda precisa configurar manualmente

1. Rodar `supabase/sql/task-push.sql` no SQL Editor. É aditivo: cria só as tabelas de assinatura e deduplicação, habilita RLS e concede acesso individual da conta autenticada à própria assinatura.
2. Conferir em Database > Tables/API Settings se `push_subscriptions` está exposta à Data API. A configuração concede `authenticated`, mas projetos que desativaram exposição automática de tabelas precisam habilitá-la.
3. Gerar o par VAPID com `node supabase/scripts/generate-vapid-keys.mjs` uma única vez. Guardar `VAPID_KEYS_JSON` fora do Git: rotacionar o par VAPID exige inscrever novamente os dispositivos.
4. Em Supabase > Settings > API Keys criar uma secret API key chamada `task_push`. Em Edge Functions > Secrets configurar `VAPID_KEYS_JSON` com a saída do script e `VAPID_SUBJECT` com um contato válido (por exemplo `mailto:admin@dominio-real.com`).
5. Em GitHub > Settings > Secrets and variables > Actions > Variables criar `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` com o valor impresso nessa linha; publicar um novo build estático para embutir a chave.
6. Deploy da função `dispatch-task-notifications` com `supabase/config.toml` e `supabase/functions/dispatch-task-notifications/`. O gateway não valida JWT; `@supabase/server` exige a secret API key nomeada `task_push` antes de executar o dispatcher.
7. No Vault do Supabase guardar `task_push_function_url` e `task_push_apikey` (a secret API key `task_push`). Rodar `supabase/sql/schedule-task-push.sql` para agendar o despacho por minuto.

O Cron roda a cada minuto; a primeira execução disponível em cada hora local entre 9h e 18h envia no máximo uma notificação horária. A chave única evita duplicatas se execuções coincidirem. O aviso de pausa pode sair até um minuto depois das três horas. Push exige HTTPS e permissão; em iOS, testar com o app instalado na Tela de Início. Nenhuma alteração foi aplicada ao projeto Supabase remoto neste trabalho.
