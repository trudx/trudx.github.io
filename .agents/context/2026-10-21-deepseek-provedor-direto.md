# DeepSeek como provedor direto

## Resumo

DeepSeek passou a aparecer como provedor próprio em Configurações → Assistente IA, com token da DeepSeek.

## Arquivos alterados

- `lib/ai/types.ts`
- `lib/ai/models.ts`
- `services/ai-service.ts`
- `app/dashboard/settings/_components/ai-settings-setting.tsx`
- `tests/ai-provider.test.ts`
- `README.md`

## Alterações

- Endpoint oficial `https://api.deepseek.com/chat/completions` e link para obter token.
- Modelos `deepseek-flash` (atualmente DeepSeek V4.1 Flash) e `deepseek-v4-pro`, com opção personalizada.
- Chat Completions com ferramentas MCP; raciocínio habilitado com esforço baixo nos dois presets.
- `reasoning_content` preservado entre chamadas de ferramentas, como exigido pela documentação oficial.

## Decisões

- Integração direta reutiliza o adaptador compatível existente, sem dependências novas.
- Nomes de modelos e formato conferidos em https://api-docs.deepseek.com/ e https://api-docs.deepseek.com/guides/thinking_mode/ em 21/10/2026.

## Estado atual

- Teste específico verifica endpoint, token próprio, catálogo de ferramentas, modelo personalizado e preservação de contexto do DeepSeek.
- Dez testes de configuração/adaptadores, TypeScript e lint passaram.

## Pendências

- Chamada com token real do provedor e validação no navegador dependem de credenciais ausentes no checkout.
