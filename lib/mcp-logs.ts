export type McpLogStatus = "ok" | "error";

/** Linha da tabela da aba: sem o `result`, que pode ser grande e só aparece no detalhe. */
export type McpLogRecord = {
  id: string;
  agent: string | null;
  agent_model: string | null;
  client_name: string | null;
  client_version: string | null;
  session_id: string | null;
  method: string;
  tool: string | null;
  arguments: Record<string, unknown> | null;
  status: McpLogStatus;
  error: string | null;
  duration_ms: number;
  created_at: string;
};

export type McpLogDetail = McpLogRecord & {
  result: unknown;
  ip: string | null;
  user_agent: string | null;
};

export type McpAgentSummary = {
  agent: string;
  total: number;
  erros: number;
  ultimaChamada: string;
};

export type McpLogFilters = {
  /** `"todas"` ou o nome da IA; `"não informado"` = chamadas sem IA identificada. */
  agent: string;
  status: McpLogStatus | "all";
  /** `true` = só chamadas de ferramenta (o que a IA fez); `false` = todo o protocolo. */
  onlyActions: boolean;
};

export const MCP_LOG_LIST_SELECT =
  "id,agent,agent_model,client_name,client_version,session_id,method,tool,arguments,status,error,duration_ms,created_at";

export const UNKNOWN_AGENT = "não informado";

export const DEFAULT_MCP_LOG_FILTERS: McpLogFilters = {
  agent: "todas",
  status: "all",
  onlyActions: true,
};

const AGENT_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  copilot: "Copilot",
  cursor: "Cursor",
  deepseek: "DeepSeek",
};

const AGENT_STYLES: Record<string, string> = {
  claude: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  chatgpt: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  gemini: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  copilot: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export function getAgentLabel(agent: string | null) {
  if (!agent || agent === UNKNOWN_AGENT) return "Não informada";
  return AGENT_LABELS[agent] ?? agent.charAt(0).toUpperCase() + agent.slice(1);
}

export function getAgentClassName(agent: string | null) {
  return (agent && AGENT_STYLES[agent]) || "border-foreground/15 text-muted-foreground";
}

const TOOL_LABELS: Record<string, string> = {
  contexto_tarefas: "Consultou o kanban",
  listar_tarefas: "Listou tarefas",
  ver_tarefa: "Abriu tarefa",
  criar_tarefa: "Criou tarefa",
  editar_tarefa: "Editou tarefa",
  excluir_tarefa: "Excluiu tarefa",
};

const METHOD_LABELS: Record<string, string> = {
  initialize: "Conectou",
  "tools/list": "Listou ferramentas",
  ping: "Ping",
  "resources/list": "Listou recursos",
  "resources/templates/list": "Listou modelos de recurso",
  "prompts/list": "Listou prompts",
};

export function getActionLabel(log: Pick<McpLogRecord, "method" | "tool">) {
  if (log.method === "tools/call")
    return (log.tool && TOOL_LABELS[log.tool]) ?? `Chamou ${log.tool ?? "ferramenta"}`;
  return METHOD_LABELS[log.method] ?? log.method;
}

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  description: "descrição",
  priority: "prioridade",
  column_id: "coluna",
  cliente_id: "cliente",
  average_duration_minutes: "duração",
  due_date: "prazo",
  flag_ids: "flags",
};

/** Uma linha que diz sobre o que foi a ação, a partir dos argumentos enviados. */
export function getActionDetail(log: Pick<McpLogRecord, "method" | "tool" | "arguments">) {
  const args = log.arguments ?? {};
  if (log.method === "initialize") {
    const protocol = typeof args.protocolVersion === "string" ? args.protocolVersion : null;
    return protocol ? `Protocolo ${protocol}` : null;
  }
  if (log.method !== "tools/call") return null;

  const title = typeof args.title === "string" ? `“${args.title}”` : null;
  switch (log.tool) {
    case "criar_tarefa":
      return title;
    case "editar_tarefa": {
      const fields = Object.keys(FIELD_LABELS)
        .filter((key) => Object.hasOwn(args, key))
        .map((key) => FIELD_LABELS[key]);
      return fields.length ? `Alterou ${fields.join(", ")}` : null;
    }
    case "listar_tarefas": {
      const filters = [
        "column_id",
        "cliente_id",
        "priority",
        "flag_id",
        "busca",
        "prazo_de",
        "prazo_ate",
      ].filter((key) => Object.hasOwn(args, key));
      return filters.length ? `Filtros: ${filters.join(", ")}` : "Sem filtros";
    }
    default:
      return typeof args.id === "string" ? `id ${args.id.slice(0, 8)}…` : null;
  }
}

export function formatLogDateTime(timestamp: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function formatLogDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Endpoint público da Edge Function do MCP. */
export function getMcpEndpoint(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/mcp`;
}

/** Junta páginas sem repetir linha: um log novo desloca o offset e reenvia a última da página. */
export function appendLogPage(current: McpLogRecord[], received: McpLogRecord[]) {
  const known = new Set(current.map((log) => log.id));
  return [...current, ...received.filter((log) => !known.has(log.id))];
}
