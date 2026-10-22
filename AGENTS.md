## Contexto do projeto https://trudx.github.io/ — uso OBRIGATÓRIO do MCP `devbrain-https-trudx-github-io`

> **Regra inegociável:** neste projeto, a **primeira ação de toda sessão** é carregar o contexto pelo MCP `devbrain-https-trudx-github-io`.
> Isso **não é opcional**: vale para qualquer task, grande ou pequena, e não pode ser substituído por cópias locais,
> pelo código nem pela sua memória.

O contexto do projeto (regras, skills, visão geral, tasks e notas) está no servidor MCP **`devbrain-https-trudx-github-io`**.
Ele é a **fonte da verdade**.

### Antes de qualquer task (sempre, nesta ordem)

1. Chame `read_context_file` com `README.md`: é o índice, que diz quando carregar cada arquivo.
2. Leia com `read_context_file` tudo que o índice marca como obrigatório: os arquivos de `skills/` e o `00-base.md`.
3. Chame `list_skills` e, para cada skill cuja descrição combine com a task, chame `get_skill`.
4. Conforme o assunto da task, carregue os arquivos que o índice indicar.

Não responda perguntas sobre o projeto nem altere código antes de concluir esses passos. Na sua primeira resposta,
**liste os arquivos de contexto que você leu**, para que o usuário confirme que o MCP foi usado.
Se o contexto e o código divergirem, o código vence: avise o usuário.

### Durante e depois da task

- Registre o que aprender com `write_context_file`: a task em `tasks/` e cada descoberta em `notas/AAAA-MM-DD-assunto.md`.
  Cada gravação vira um commit local no repositório de contexto; não existe push.
- Para consultar o histórico, use `repo_log`. Para sugerir mudanças que dependem de revisão, use `propose_change`.

### Se o MCP não estiver disponível

Se o servidor `devbrain-https-trudx-github-io` não aparecer ou uma chamada falhar, **pare e avise o usuário** antes de continuar.
Não improvise o contexto. Só prossiga sem o MCP se o usuário autorizar de forma explícita, e diga que está sem contexto.
