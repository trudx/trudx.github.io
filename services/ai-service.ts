//* Types Imports
import type { AiMessage, AiSettings, McpTool, ToolCall } from "../lib/ai/types.ts";

//* Utils Imports
import { AI_PROVIDERS } from "../lib/ai/models.ts";
import {
  createDiagnosticLogger,
  redactDiagnostic,
  registerDiagnosticSecret,
} from "../lib/browser-logs.ts";
import { AiRequestError, describeAiTransportFailure } from "../lib/ai/request-error.ts";

type JsonObject = Record<string, unknown>;

function compatibleParameters(tool: McpTool, settings: AiSettings) {
  const parameters = structuredClone(tool.inputSchema);
  if (
    settings.provider === "gemini" ||
    (settings.provider === "openrouter" && settings.model.startsWith("google/gemini"))
  ) {
    const properties = parameters.properties as Record<string, JsonObject> | undefined;
    if (properties && Object.keys(properties).length === 0) return undefined;
    // O Gemini não representa dicionários abertos de forma consistente em function declarations.
    // O MCP continua recebendo objetos: o agente decodifica estes dois campos na fronteira da API.
    for (const key of ["data", "filters"]) {
      if (properties?.[key])
        properties[key] = {
          type: "string",
          description: `${key}: objeto JSON serializado como string. Exemplo: {\"title\":\"Reunião\"}. Use os campos do resources_describe.`,
        };
    }
  }
  return parameters;
}

export function toResponsesInput(messages: AiMessage[]): unknown[] {
  return messages.flatMap((message): unknown[] => {
    if (message.role === "tool")
      return [
        {
          type: "function_call_output",
          call_id: message.tool_call_id,
          output: message.content ?? "",
        },
      ];
    if (message.role === "assistant" && Array.isArray(message.responseItems))
      return message.responseItems;
    return [{ role: message.role, content: message.content ?? "" }];
  });
}

export function buildAiRequest(
  settings: AiSettings,
  messages: AiMessage[],
  tools: McpTool[],
  instructions: string,
): JsonObject {
  if (settings.provider === "openai") {
    return {
      model: settings.model,
      store: false,
      instructions,
      input: toResponsesInput(messages),
      tools: tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: compatibleParameters(tool, settings),
        strict: false,
      })),
      parallel_tool_calls: false,
      max_output_tokens: 8192,
      include: ["reasoning.encrypted_content"],
    };
  }
  return {
    model: settings.model,
    messages: [
      { role: "system", content: instructions },
      ...messages.map((message) => {
        const copy = { ...message };
        delete copy.responseItems;
        return copy;
      }),
    ],
    tools: tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: compatibleParameters(tool, settings),
      },
    })),
    tool_choice: "auto",
    max_tokens: 8192,
    ...(settings.provider === "deepseek" &&
    ["deepseek-flash", "deepseek-v4-pro"].includes(settings.model)
      ? { thinking: { type: "enabled" }, reasoning_effort: "low" }
      : {}),
    ...(settings.provider === "openrouter" ? { provider: { require_parameters: true } } : {}),
  };
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function parseAiResponse(provider: AiSettings["provider"], value: unknown): AiMessage {
  const data = object(value);
  if (provider === "openai") {
    if (data.status === "incomplete" || data.status === "failed")
      throw new Error("O modelo não concluiu a resposta. Tente um pedido menor ou outro modelo.");
    const output = Array.isArray(data.output) ? data.output.map(object) : [];
    const calls: ToolCall[] = output
      .filter((item) => item.type === "function_call")
      .map((item) => ({
        id: String(item.call_id ?? ""),
        type: "function",
        function: { name: String(item.name ?? ""), arguments: String(item.arguments ?? "{}") },
      }));
    if (calls.some((call) => !call.id || !call.function.name))
      throw new Error("O modelo retornou uma chamada de ferramenta inválida.");
    const content = output
      .filter((item) => item.type === "message")
      .flatMap((item) => (Array.isArray(item.content) ? item.content.map(object) : []))
      .map((part) =>
        part.type === "output_text"
          ? String(part.text ?? "")
          : part.type === "refusal"
            ? String(part.refusal ?? "")
            : "",
      )
      .join("\n");
    if (!content && !calls.length) throw new Error("O provedor retornou uma resposta vazia.");
    return {
      role: "assistant",
      content: content || null,
      ...(calls.length ? { tool_calls: calls } : {}),
      responseItems: data.output,
    };
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = object(choices[0]);
  if (choice.finish_reason === "length")
    throw new Error("O modelo atingiu o limite de resposta. Tente um pedido menor.");
  const message = object(choice.message);
  const calls = Array.isArray(message.tool_calls) ? (message.tool_calls as ToolCall[]) : [];
  for (const call of calls) {
    if (
      !call.id ||
      call.type !== "function" ||
      typeof call.function?.name !== "string" ||
      typeof call.function.arguments !== "string"
    )
      throw new Error("O modelo retornou uma chamada de ferramenta inválida.");
  }
  const content =
    typeof message.content === "string"
      ? message.content
      : typeof message.refusal === "string"
        ? message.refusal
        : null;
  if (!content && !calls.length)
    throw new Error(
      "Este modelo não retornou texto ou chamadas de ferramentas. Experimente outro modelo.",
    );
  // Preserva reasoning_details/extra_content e assinaturas exigidas em turnos com ferramentas.
  return { ...message, role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) };
}

export async function requestAi(
  settings: AiSettings,
  messages: AiMessage[],
  tools: McpTool[],
  instructions: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<AiMessage> {
  settings = { ...settings, token: settings.token.trim(), model: settings.model.trim() };
  if (!settings.token.trim() || !settings.model.trim())
    throw new Error("Salve o token e o modelo em Configurações → Assistente IA.");
  if (signal.aborted)
    throw signal.reason ?? new DOMException("Execução interrompida", "AbortError");
  if (/[\r\n]/.test(settings.token))
    throw new Error("O token contém uma quebra de linha. Cole novamente apenas a chave da API.");
  const provider = AI_PROVIDERS[settings.provider];
  const diagnosticId = crypto.randomUUID().slice(0, 8);
  const log = createDiagnosticLogger();
  registerDiagnosticSecret(settings.token);
  const started = Date.now();
  const diagnostic = {
    diagnosticId,
    provider: settings.provider,
    model: settings.model,
    endpoint: provider.endpoint,
    online: typeof navigator === "undefined" || navigator.onLine !== false,
    origin: typeof location === "undefined" ? "server" : location.origin,
  };
  log({
    level: "info",
    source: "ai.request",
    message: `Consultando ${provider.name}`,
    details: diagnostic,
  });
  // Evita depender de AbortSignal.any/timeout, ausentes em alguns navegadores.
  const requestController = new AbortController();
  const abort = () => requestController.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => requestController.abort(new DOMException("Tempo limite da API", "TimeoutError")),
    120000,
  );
  try {
    const body = JSON.stringify(buildAiRequest(settings, messages, tools, instructions));
    let response: Response;
    try {
      response = await fetcher(provider.endpoint, {
        method: "POST",
        signal: requestController.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.token}` },
        body,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch (error) {
      if (signal.aborted) throw error;
      const failure = describeAiTransportFailure(
        requestController.signal.reason ?? error,
        typeof navigator === "undefined" || navigator.onLine !== false,
        provider.name,
        diagnosticId,
      );
      log({
        level: "error",
        source: "ai.transport",
        message: failure.message,
        details: {
          ...diagnostic,
          kind: failure.kind,
          elapsedMs: Date.now() - started,
          error: redactDiagnostic(error, [settings.token]),
        },
      });
      throw failure;
    }
    const responseInfo = {
      ...diagnostic,
      status: response.status,
      elapsedMs: Date.now() - started,
      requestId: response.headers.get("x-request-id") ?? response.headers.get("x-ds-trace-id"),
      contentType: response.headers.get("content-type"),
    };
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      if (requestController.signal.aborted) {
        const failure = describeAiTransportFailure(
          requestController.signal.reason,
          true,
          provider.name,
          diagnosticId,
        );
        log({
          level: "error",
          source: "ai.transport",
          message: failure.message,
          details: responseInfo,
        });
        throw failure;
      }
      const failure = new AiRequestError(
        response.ok ? "invalid-response" : "http",
        `${provider.name} respondeu HTTP ${response.status}, mas a resposta não é JSON válido ou foi interrompida. Abra os logs. Diagnóstico: ${diagnosticId}.`,
        diagnosticId,
        response.status,
      );
      log({
        level: "error",
        source: "ai.response",
        message: failure.message,
        details: { ...responseInfo, error: redactDiagnostic(error, [settings.token]) },
      });
      throw failure;
    }
    if (!response.ok || object(data).error) {
      const detail = object(object(data).error).message;
      const message =
        response.status === 401
          ? "Token inválido. Confira a chave do provedor."
          : response.status === 403
            ? "O provedor negou acesso. Confira as permissões do token, modelo e região da conta."
            : response.status === 402
              ? "A conta do provedor está sem créditos. Confira o saldo da API."
              : response.status === 429
                ? "O provedor atingiu o limite de uso ou de créditos. Confira sua conta e tente novamente."
                : "O provedor recusou a solicitação.";
      const safeDetail =
        typeof detail === "string" ? redactDiagnostic(detail, [settings.token]).slice(0, 700) : "";
      const failure = new AiRequestError(
        "http",
        `${message} HTTP ${response.status}.${safeDetail ? ` ${safeDetail}` : ""} Diagnóstico: ${diagnosticId}.`,
        diagnosticId,
        response.status,
      );
      log({ level: "error", source: "ai.http", message: failure.message, details: responseInfo });
      throw failure;
    }
    try {
      const result = parseAiResponse(settings.provider, data);
      log({
        level: "info",
        source: "ai.response",
        message: "Resposta da IA recebida",
        details: { ...responseInfo, toolCalls: result.tool_calls?.length ?? 0 },
      });
      return result;
    } catch (error) {
      const failure = new AiRequestError(
        "invalid-response",
        `${provider.name} respondeu HTTP ${response.status}, mas não foi possível processar a resposta: ${redactDiagnostic(error instanceof Error ? error.message : error, [settings.token])} Diagnóstico: ${diagnosticId}.`,
        diagnosticId,
        response.status,
      );
      log({
        level: "error",
        source: "ai.parse",
        message: failure.message,
        details: { ...responseInfo, error: redactDiagnostic(error, [settings.token]) },
      });
      throw failure;
    }
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export async function testAiConnection(settings: AiSettings, signal: AbortSignal) {
  // Faz apenas uma chamada curta ao modelo; não consulta nem altera dados do app.
  await requestAi(
    settings,
    [{ role: "user", content: "Responda somente OK. Não execute ferramentas." }],
    [],
    "Teste de conexão do Trudx. Responda OK.",
    signal,
  );
}
