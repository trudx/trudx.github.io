# Assistente IA com MCP interno

## Resumo

Chat flutuante no dashboard, configuração de provedor/modelo/token e ferramentas para consultar e alterar os dados da conta autenticada. Integração compatível com a exportação estática existente do GitHub Pages.

## Arquivos alterados

- `public/ai/mcp.json`: catálogo compartilhado e disponível para download.
- `lib/ai/`: tipos, modelos, armazenamento, schemas de recursos, contexto, executor JSON-RPC e ciclo do agente.
- `services/ai-service.ts`: adaptadores de Responses da OpenAI e Chat Completions do OpenRouter/Gemini, teste de conexão e tratamento de erros.
- `hooks/use-ai-settings.ts`, `hooks/use-ai-chat.ts`, `hooks/use-app-data-refresh.ts`.
- `app/dashboard/_components/ai-provider.tsx`, `ai-chat.tsx`, `ai-chat-panel.tsx`, `ai-chat-message.tsx`.
- `app/dashboard/layout.tsx`.
- `app/dashboard/settings/page.tsx`, `_components/index.ts`, `_components/ai-settings-setting.tsx`.
- Hooks de tarefas, colunas, clientes, agenda, financeiro, saldos, categorias, grupos, gastos fixos, bancos e cronômetro: atualização após alterações da IA.
- `lib/financeiro/balance.ts` e `hooks/use-financeiro-saldos.ts`: conversão da resposta de saldos compartilhada com o assistente.
- `tests/ai-mcp.test.ts`, `tests/ai-provider.test.ts`, `tests/ai-agent.test.ts`.
- `README.md`.

## Alterações

- Provedores OpenRouter, OpenAI e Google Gemini; modelos pesquisados nos catálogos oficiais em 21/10/2026. IDs personalizados disponíveis em todos os provedores.
- Token ocultável, teste de conexão e remoção da configuração. Trocar provedor limpa o token do formulário para não encaminhar a chave ao provedor errado.
- Configuração por conta no localStorage; histórico apenas na memória da aba e limpo na troca de conta. Mudança de configuração interrompe a execução atual.
- Chat acessível não modal, responsivo, com sugestões iniciais, envio por Enter, nova linha por Shift+Enter, limpeza da conversa e botão para interromper a execução.
- Catálogo de nove ferramentas: schemas dos recursos, consulta paginada, criar/editar/excluir registro, criar evento com tarefa, análise financeira, saldos e cronômetro.
- Recursos: tasks, task_columns, clients, eventos, financeiro, gastos_fixos, bancos, financeiro_categorias, financeiro_grupos e financeiro_saldos_referencia.
- Schemas estritos, validação de referências por dono, checagem da sessão antes das ferramentas e das gravações, filtros obrigatórios por usuário e confirmação de edição/exclusão.
- Análise usa todos os registros paginados do período; saldos e resultados reutilizam as regras do dashboard, em centavos. Não confundir resultado do período com saldo bancário.
- Financeiro preserva as restrições de edição de valor/data/tipo e a conciliação via importação. Eventos novos usam a criação de tarefa implementada na Agenda.
- OpenAI usa Responses com preservação dos itens de raciocínio. OpenRouter/Gemini preservam metadados e assinaturas de ferramentas. Objetos dinâmicos são serializados na fronteira do Gemini e decodificados para o contrato original do MCP.
- Limites de etapas e chamadas por turno, ações exibidas com estado de conclusão/falha e histórico consistente após interrupções ou erros.

## Decisões

- MCP interno via transporte em memória, com `initialize`, `ping`, `tools/list`, `tools/call` e `notifications/initialized`. Não é um servidor MCP remoto público.
- Chave pessoal no navegador, com informação explícita na configuração sobre armazenamento e envio de mensagens/dados ao provedor. Nenhuma chave embutida no código ou persistida no Supabase.
- Usa a camada genérica de dados e as políticas RLS existentes; não usa service role, SQL arbitrário ou ferramentas administrativas.
- Sem mudança de schema ou migração. Configuração local não sincroniza entre dispositivos.
- Claude e DeepSeek são acessados pelo OpenRouter, usando um token do OpenRouter.

## Estado atual

- Testes automatizados de JSON-RPC, isolamento por conta, schemas, referências, CRUD, dados financeiros, adaptadores, armazenamento, erros, interrupção e ciclo de ferramentas.
- TypeScript e lint dos arquivos alterados passaram.
- Exportação estática com `next build --webpack` passou com variáveis de Supabase de teste, sem chamadas a dados reais. O Turbopack tentou abrir uma porta interna bloqueada no ambiente; nenhuma mudança na configuração de build foi necessária.

## Pendências

- Validação visual e integração ponta a ponta com uma sessão Supabase e token de provedor reais, ausentes neste checkout. Use Configurações → Assistente IA → Testar conexão e valide pedidos de leitura/escrita na conta desejada.
- Acesso direto a APIs depende de CORS e disponibilidade/permissões do modelo no provedor. OpenRouter é a alternativa quando uma API direta bloquear o navegador.
