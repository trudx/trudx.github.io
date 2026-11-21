//* Types Imports
import type { TaskStore } from "./store.ts";

//* Utils Imports
import { isToolName, listTools, runTool } from "./tools.ts";

export const SERVER_INFO = { name: "trudx-tarefas", title: "trudx · Tarefas", version: "1.0.0" };

/** Da mais nova para a mais antiga; responde com a que o cliente pediu, se a conhecermos. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

/** Contexto fixo entregue no `initialize`: vale para qualquer IA que se conectar. */
export const SERVER_INSTRUCTIONS = [
  "Você está conectado ao MCP de tarefas do trudx, o kanban pessoal do usuário.",
  "IDENTIFICAÇÃO OBRIGATÓRIA: toda ferramenta exige o argumento `ia` com o nome da IA que está chamando, em minúsculo (claude, chatgpt, gemini, copilot, deepseek...). Informe também `modelo` quando souber. Cada chamada fica registrada num log de auditoria que o usuário acompanha no painel; use sempre o seu nome real e o mesmo nome em todas as chamadas.",
  "Comece por contexto_tarefas para obter a data de hoje, as colunas, as flags e os clientes com seus ids; nunca invente ids.",
  "Datas no formato AAAA-MM-DD, fuso America/Sao_Paulo. Prioridades: low, medium, high.",
  "Para mover uma tarefa de coluna use editar_tarefa com column_id. Uma tarefa tem no máximo 5 flags.",
  "excluir_tarefa é definitiva: descreva a tarefa ao usuário, espere a confirmação explícita e só então chame com confirmado=true.",
].join("\n");

export type JsonRpcId = string | number | null;
type JsonRpcMessage = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

/** O que a camada HTTP grava em `mcp_logs` para cada requisição. */
export type RpcLog = {
  method: string;
  tool: string | null;
  arguments: unknown;
  result: unknown;
  status: "ok" | "error";
  error: string | null;
  agent: string | null;
  agentModel: string | null;
  clientInfo: { name?: string; version?: string } | null;
};

export type RpcOutcome = {
  /** `null` para notificação: não há resposta a enviar. */
  response: JsonRpcResponse | null;
  log: RpcLog | null;
  initialized: boolean;
};

export type RpcContext = { store: TaskStore; today: string };

export const RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

function errorResponse(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export function normalizeAgent(value: unknown) {
  const text = asText(value, 40);
  return text ? text.toLowerCase() : null;
}

/** Quando a IA não se declara, o nome do cliente MCP costuma entregar de onde ela veio. */
export function inferAgentFromClient(clientName: string | null | undefined) {
  const name = (clientName ?? "").toLowerCase();
  if (!name) return null;
  if (name.includes("claude") || name.includes("anthropic")) return "claude";
  if (name.includes("openai") || name.includes("chatgpt")) return "chatgpt";
  if (name.includes("gemini") || name.includes("google")) return "gemini";
  if (name.includes("copilot") || name.includes("vscode") || name.includes("visual studio"))
    return "copilot";
  if (name.includes("cursor")) return "cursor";
  return null;
}

function negotiateVersion(requested: unknown) {
  return typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0];
}

function baseLog(method: string): RpcLog {
  return {
    method,
    tool: null,
    arguments: null,
    result: null,
    status: "ok",
    error: null,
    agent: null,
    agentModel: null,
    clientInfo: null,
  };
}

export async function handleRpcMessage(raw: unknown, context: RpcContext): Promise<RpcOutcome> {
  const message = asRecord(raw) as JsonRpcMessage;
  const hasId = Object.hasOwn(message, "id");
  const id: JsonRpcId =
    typeof message.id === "string" || typeof message.id === "number" ? message.id : null;

  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    const log = {
      ...baseLog("invalido"),
      status: "error" as const,
      error: "Requisição JSON-RPC inválida.",
      arguments: raw,
    };
    return {
      response: errorResponse(id, RPC_ERRORS.invalidRequest, "Requisição JSON-RPC inválida."),
      log,
      initialized: false,
    };
  }

  const method = message.method;
  // Notificação (sem id): nada a responder e nada que valha log (initialized, cancelled...).
  if (!hasId) return { response: null, log: null, initialized: false };

  const params = asRecord(message.params);
  const log = baseLog(method);

  switch (method) {
    case "initialize": {
      const clientInfo = asRecord(params.clientInfo);
      log.clientInfo = {
        name: asText(clientInfo.name, 120) ?? undefined,
        version: asText(clientInfo.version, 60) ?? undefined,
      };
      log.agent = inferAgentFromClient(log.clientInfo.name);
      log.arguments = params;
      const result = {
        protocolVersion: negotiateVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      };
      log.result = { protocolVersion: result.protocolVersion };
      return { response: { jsonrpc: "2.0", id, result }, log, initialized: true };
    }

    case "ping":
      return { response: { jsonrpc: "2.0", id, result: {} }, log, initialized: false };

    case "tools/list": {
      const tools = listTools();
      log.result = { tools: tools.map((tool) => tool.name) };
      return { response: { jsonrpc: "2.0", id, result: { tools } }, log, initialized: false };
    }

    case "tools/call": {
      const name = params.name;
      const args = asRecord(params.arguments);
      log.tool = typeof name === "string" ? name.slice(0, 80) : null;
      log.arguments = args;
      log.agent = normalizeAgent(args.ia);
      log.agentModel = asText(args.modelo, 80);

      if (!isToolName(name)) {
        log.status = "error";
        log.error = `Ferramenta desconhecida: ${String(name)}`;
        return {
          response: errorResponse(id, RPC_ERRORS.invalidParams, log.error),
          log,
          initialized: false,
        };
      }

      const outcome = await runTool(name, args, context.store, context.today);
      if (!outcome.ok) {
        log.status = "error";
        log.error = outcome.error;
        // Erro de ferramenta volta como resultado com isError: o modelo lê e pode corrigir.
        return {
          response: {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: outcome.error }], isError: true },
          },
          log,
          initialized: false,
        };
      }

      log.result = outcome.data;
      const result: Record<string, unknown> = {
        content: [{ type: "text", text: JSON.stringify(outcome.data) }],
      };
      if (outcome.data && typeof outcome.data === "object" && !Array.isArray(outcome.data))
        result.structuredContent = outcome.data;
      return { response: { jsonrpc: "2.0", id, result }, log, initialized: false };
    }

    // Clientes costumam sondar estes; responder vazio evita erro na conexão.
    case "resources/list":
      return {
        response: { jsonrpc: "2.0", id, result: { resources: [] } },
        log,
        initialized: false,
      };
    case "resources/templates/list":
      return {
        response: { jsonrpc: "2.0", id, result: { resourceTemplates: [] } },
        log,
        initialized: false,
      };
    case "prompts/list":
      return { response: { jsonrpc: "2.0", id, result: { prompts: [] } }, log, initialized: false };

    default:
      log.status = "error";
      log.error = `Método não suportado: ${method}`;
      return {
        response: errorResponse(id, RPC_ERRORS.methodNotFound, log.error),
        log,
        initialized: false,
      };
  }
}
