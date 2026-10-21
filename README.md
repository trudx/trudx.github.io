# trudx

trudx é uma aplicação web para gestão de freelancers e pequenos negócios. A plataforma permite autenticar usuários, cadastrar e organizar clientes, tarefas, agenda e financeiro num só lugar.

## Funcionalidades

- Landing page de apresentação.
- Login com Supabase Auth e feedback por toasts.
- Proteção da área autenticada.
- Dashboard com navegação lateral.
- CRUD de clientes: criar, listar, editar e excluir.
- Kanban de tarefas: criar, editar, excluir, mover entre colunas configuráveis e gerenciar as próprias colunas.
- Busca por nome, contato ou status.
- Indicadores de clientes ativos e inativos.
- Configurações de nome, e-mail e senha.
- Assistente IA com chat flutuante, token pessoal e modelos pré-selecionados ou personalizados.
- Logout automático após alteração de e-mail ou senha.
- Interface responsiva em estilo shadcn, com paleta monocromática.

## Assistente IA

Em **Configurações → Assistente IA**, escolha OpenRouter, OpenAI, Google Gemini ou DeepSeek, selecione um modelo e informe seu token de API. DeepSeek aceita token próprio, com V4.1 Flash, V4 Pro e modelo personalizado. O OpenRouter reúne modelos de vários provedores, incluindo Claude e DeepSeek. É possível testar a conexão antes de salvar e remover o token depois. Abra o chat pelo botão no canto inferior direito do dashboard.

O token fica no armazenamento local deste navegador, separado por conta; não é sincronizado com o Supabase nem protegido por um servidor de segredos. Mensagens e resultados das ferramentas são enviados ao provedor escolhido. As últimas três conversas ficam salvas por conta neste navegador, com até 40 mensagens por conversa e contexto recente limitado a 48 mil caracteres. O botão + abre uma nova conversa, o seletor restaura conversas recentes e a lixeira apaga a conversa selecionada. Ações antigas não são reenviadas nem repetidas ao restaurar o contexto. APIs podem cobrar pelo uso e exigir créditos próprios, independentemente de assinaturas de chat.

**Logs do navegador** estão disponíveis pelo ícone no chat e pelo botão em Configurações. O armazenamento local retém até 100 registros por conta; o 101º remove o mais antigo. A janela permite buscar, filtrar, limpar e baixar JSON. Registra console, erros não tratados, bloqueios de política de segurança e diagnóstico das chamadas de IA, ocultando tokens e senhas. Requisições registram provedor, endpoint sem credenciais, modelo, duração, status HTTP quando disponível e um ID de diagnóstico; mensagens do chat e corpos de requisição não são registrados. Se o armazenamento estiver bloqueado/cheio, a interface informa que os dados ficaram apenas em memória.

Falhas de transporte, timeout, autenticação, créditos e respostas inválidas são tratadas separadamente. Uma falha de `fetch` sem status HTTP não permite confirmar pelo JavaScript se a causa é CORS, DNS, TLS ou uma extensão: use o ID na janela de logs e a aba Rede do DevTools. O teste público de preflight do DeepSeek em 21/10/2026 aceitou a origem `https://trudx.github.io`; isso não comprova a causa de falhas em outro navegador ou rede.

O catálogo em [`public/ai/mcp.json`](public/ai/mcp.json) alimenta um MCP interno via JSON-RPC, executado no navegador (`initialize`, `tools/list`, `tools/call`). Ele não publica um servidor MCP remoto. O executor permite consultar e alterar tarefas, colunas, clientes, agenda, financeiro, gastos fixos, bancos, categorias, grupos e referências de saldo, além de controlar cronômetros. As chamadas usam a sessão autenticada, filtros por usuário, validação de campos e referências e as políticas RLS existentes. Credenciais e operações administrativas não são expostas.

Análises e saldos reaproveitam as funções do dashboard e trabalham com centavos; criação e consulta de lançamentos usam reais. Eventos são criados com a tarefa correspondente e exigem escolher a coluna. Alterações da IA atualizam os dados nas telas abertas. O chat permite interromper novas ações e mostra quais já foram concluídas.

Modelos consultados em 21/10/2026 nas documentações de [OpenAI](https://developers.openai.com/api/docs/models), [Claude](https://platform.claude.com/docs/en/models/overview), [Gemini](https://ai.google.dev/gemini-api/docs/models), [DeepSeek](https://api-docs.deepseek.com/) e no [catálogo OpenRouter](https://openrouter.ai/api/v1/models). Modelos personalizados precisam oferecer suporte a ferramentas. Se um provedor direto bloquear acesso pelo navegador, use OpenRouter; a integração mantém a exportação estática do GitHub Pages.

## Rotas

| Rota                  | Descrição                                  |
| --------------------- | ------------------------------------------ |
| `/`                   | Apresentação do projeto                    |
| `/login`              | Login do usuário                           |
| `/dashboard`          | Visão geral da área autenticada            |
| `/dashboard/clients`  | Gerenciamento de clientes                  |
| `/dashboard/tasks`    | Board Kanban para gerenciamento de tarefas |
| `/dashboard/settings` | Configurações da conta                     |

## Stack

- Next.js 16 com App Router.
- React 19 e TypeScript.
- Supabase Auth e banco de dados.
- Tailwind CSS 4.
- Componentes locais baseados em shadcn/ui.
- Base UI para primitives acessíveis.
- Sonner para notificações.

## Como executar

### Pré-requisitos

- Node.js 20 ou superior.
- Um projeto Supabase configurado.

### Instalação

```bash
npm install
```

Crie um arquivo `.env` a partir do `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=seu_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Scripts

| Comando         | Uso                                  |
| --------------- | ------------------------------------ |
| `npm run dev`   | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção             |
| `npm run start` | Executa o build de produção          |
| `npm run lint`  | Executa o ESLint                     |

## Organização do código

```text
app/                 Rotas e páginas do App Router
app/dashboard/       Área autenticada e telas do CRUD
components/ui/       Primitives reutilizáveis inspiradas no shadcn/ui
hooks/               Autenticação, perfil, logout e clientes
lib/                 Utilitários e configuração compartilhada
public/               Arquivos estáticos
```

## Pacotes utilizados

### Dependências de aplicação

| Pacote                                | Uso resumido                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `@base-ui/react`                      | Primitives acessíveis para botões, inputs, dialogs e outros componentes de UI. |
| `@dnd-kit/core` e `@dnd-kit/sortable` | Drag-and-drop acessível para o board de tarefas.                               |
| `@supabase/ssr`                       | Suporte do Supabase para cenários SSR e integração com frameworks.             |
| `@supabase/supabase-js`               | Cliente JavaScript usado para autenticação e operações no Supabase.            |
| `class-variance-authority`            | Criação de variantes tipadas para componentes como Button e Badge.             |
| `clsx`                                | Composição condicional de classes CSS.                                         |
| `cmdk`                                | Base para interfaces de comandos e busca rápida.                               |
| `embla-carousel-react`                | Motor de carrossel para React.                                                 |
| `input-otp`                           | Componentes para entrada de códigos OTP.                                       |
| `lucide-react`                        | Biblioteca de ícones React.                                                    |
| `next`                                | Framework principal da aplicação.                                              |
| `next-themes`                         | Gerenciamento de tema para componentes compatíveis.                            |
| `react`                               | Biblioteca de construção da interface.                                         |
| `react-day-picker`                    | Seletor de datas.                                                              |
| `react-dom`                           | Renderização do React no navegador.                                            |
| `react-resizable-panels`              | Painéis redimensionáveis.                                                      |
| `recharts`                            | Gráficos e visualizações de dados.                                             |
| `sonner`                              | Toasts de sucesso, erro e aviso.                                               |
| `tailwind-merge`                      | Mesclagem inteligente de classes Tailwind.                                     |
| `zod`                                 | Validação e definição de schemas TypeScript/JavaScript.                        |

### Dependências de desenvolvimento

| Pacote                 | Uso resumido                                 |
| ---------------------- | -------------------------------------------- |
| `@tailwindcss/postcss` | Integração do Tailwind CSS com PostCSS.      |
| `@types/node`          | Tipos TypeScript para APIs do Node.js.       |
| `@types/react`         | Tipos TypeScript para React.                 |
| `@types/react-dom`     | Tipos TypeScript para React DOM.             |
| `eslint`               | Linter para identificar problemas no código. |
| `eslint-config-next`   | Regras do ESLint específicas para Next.js.   |
| `tailwindcss`          | Framework utilitário de estilos.             |
| `typescript`           | Tipagem estática e compilação TypeScript.    |

> O projeto usa componentes locais inspirados no shadcn/ui. Por isso, `shadcn/ui` não aparece como uma dependência única no `package.json`; os componentes ficam versionados em `components/ui`.
