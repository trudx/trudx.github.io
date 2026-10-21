# Logs locais, histórico de três chats e diagnóstico da IA

## Resumo

Substituído o erro genérico de conexão por diagnósticos distintos de transporte, offline, timeout, HTTP e formato da resposta. Adicionada janela de logs persistidos no navegador e restauração das três conversas mais recentes por conta. Limpeza de arquivos e dependência sem uso.

## Arquivos alterados

- `lib/browser-logs.ts` e `components/browser-logs-dialog.tsx`.
- `lib/ai/request-error.ts`, `lib/ai/chat-store.ts`, `lib/ai/agent.ts`.
- `services/ai-service.ts` e `hooks/use-ai-chat.ts`.
- Componentes `ai-provider.tsx`, `ai-chat-panel.tsx`, `ai-settings-setting.tsx` e página de Configurações.
- Testes `browser-logs.test.ts`, `ai-chat-store.test.ts`, `ai-request-errors.test.ts`, adaptadores e helper de localStorage.
- `package.json`, `package-lock.json`, `README.md`, comentário de `dashboard-hero.tsx`.
- Removidos `public/{manha,noite,tarde}.png` e SVGs do template sem referências (`file`, `globe`, `next`, `vercel`, `window`).
- `supabase/functions/dispatch-task-notifications/index.ts`: removida variável de catch sem uso e nomeado o objeto exportado para eliminar os dois avisos anteriores de lint, sem mudança funcional.

## Alterações

- Logs de console, erros globais, promises rejeitadas, bloqueios CSP, online/offline, requisições e ferramentas da IA. Até 100 por conta; entrada nova remove a mais antiga.
- Cada chamada da IA registra ID de diagnóstico, provedor/modelo, endpoint sem credenciais, origem, estado de rede, duração e status HTTP quando disponível. Não registra corpos de requisição nem conversas.
- Tokens, JWTs, senhas e credenciais são ocultados antes da persistência. Captura é removida na troca de conta/desmontagem; diagnósticos assíncronos não migram para outra conta.
- Janela acessível pelo chat e Configurações com busca, filtro de nível, download JSON e limpeza.
- Histórico de três conversas por conta no localStorage; até 40 mensagens por conversa e 48 mil caracteres de contexto restaurado. Nova conversa não remove uma antiga enquanto estiver vazia.
- Contexto restaurado contém texto e resumo das ações, sem reenviar chamadas antigas ou metadados assinados. Execuções interrompidas são sinalizadas; ações concluídas continuam registradas.
- Removida dependência de `AbortSignal.any`/`AbortSignal.timeout` na chamada ao provedor, com cancelamento e timeout via AbortController.
- Removidas imagens PNG duplicadas já substituídas por WebP importado estaticamente (~6 MB), SVGs iniciais sem uso e dependência direta `dotenv` sem importações.

## Decisões

- “Salvo em local host” foi implementado como armazenamento local do navegador, por origem e conta, mantendo compatibilidade com GitHub Pages.
- Um TypeError no processamento da resposta não deve ser classificado como falha de rede. Uma rejeição de fetch sem resposta não permite diferenciar CORS, DNS, TLS, extensão e indisponibilidade pelo JavaScript; logs e mensagem informam essa limitação.
- Teste público OPTIONS de `https://api.deepseek.com/chat/completions`, sem token, aceitou `Origin: https://trudx.github.io`, método POST e cabeçalhos authorization/content-type com HTTP 200 e allow-origin correspondente em 21/10/2026. Isso não confirma a causa da falha no navegador do usuário.
- Armazenamento bloqueado ou sem espaço não derruba o app: logs continuam em memória, e logs/histórico informam a falha de persistência.

## Estado atual

- Testes passaram, incluindo retenção FIFO de 100 logs, exclusão da quarta conversa, isolamento de contas, redação de segredos, contexto sem reexecutar ações, cancelamento e distinção de erros HTTP/transportes/respostas.
- TypeScript e lint do projeto inteiro passaram.
- Build estático via Webpack passou, com variáveis Supabase de teste; sem publicação remota.

## Pendências

- A causa específica da falha original depende de reproduzir no navegador afetado e consultar o ID na nova janela de logs/aba Rede. Nenhum token real do provedor foi usado nos testes.
