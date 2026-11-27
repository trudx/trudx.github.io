import { isJsonObject, validateMcpConfig } from "./custom-mcp-config.ts";
import type { CustomMcpConfig, CustomMcpServer } from "./custom-mcp-config.ts";
import type { McpTool } from "./types.ts";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_TOOLS = 100;

function parseResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("O servidor enviou uma resposta MCP inválida.");
  }
}

function matchingEvent(event: string, id: number) {
  const data = event
    .split(/\r\n|\r|\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return;
  const message = parseResponse(data);
  if (isJsonObject(message) && message.id === id) return message;
}

async function readResponse(response: Response, id: number) {
  const stream = response.headers.get("content-type")?.includes("text/event-stream");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("O servidor não retornou uma resposta MCP.");

  let bytes = 0;
  let buffer = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("A resposta MCP excedeu 1 MB.");
      buffer += decoder.decode(value, { stream: true });
      if (!stream) continue;

      // A resposta JSON-RPC pode chegar antes do encerramento do stream.
      const events = buffer.split(/\r\n\r\n|\n\n|\r\r/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const message = matchingEvent(event, id);
        if (message) return message;
      }
    }

    buffer += decoder.decode();
    return stream ? matchingEvent(buffer, id) : parseResponse(buffer);
  } finally {
    void reader.cancel().catch(() => {});
  }
}

function openMcpSession(config: CustomMcpConfig, signal?: AbortSignal) {
  const { url, headers } = validateMcpConfig(config.name, config.url, config.headers);
  let sessionId: string | null = null;
  let version: string | undefined;
  let nextId = 0;

  function requestHeaders() {
    const request = new Headers(headers);
    request.set("Accept", "application/json, text/event-stream");
    if (sessionId) request.set("Mcp-Session-Id", sessionId);
    if (version) request.set("MCP-Protocol-Version", version);
    return request;
  }

  async function send(method: string, callSignal: AbortSignal, params?: object, notification = false) {
    const id = notification ? undefined : ++nextId;
    const request = requestHeaders();
    request.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: request,
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: callSignal,
      });
    } catch {
      signal?.throwIfAborted();
      if (callSignal.aborted) throw new Error("O servidor MCP demorou demais para responder.");
      throw new Error("O navegador não conseguiu conectar. Confira a URL e o CORS do servidor.");
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error(`O servidor MCP retornou HTTP ${response.status}.`);
    }
    if (id === undefined) {
      void response.body?.cancel().catch(() => {});
      return {};
    }

    if (method === "initialize") sessionId = response.headers.get("Mcp-Session-Id");
    const message = await readResponse(response, id).catch((error: unknown) => {
      signal?.throwIfAborted();
      if (callSignal.aborted) throw new Error("O servidor MCP demorou demais para responder.");
      throw error;
    });
    if (!isJsonObject(message) || message.jsonrpc !== "2.0" || message.id !== id)
      throw new Error("O servidor enviou uma resposta MCP inválida.");
    if (message.error) throw new Error(`O servidor recusou a solicitação ${method}.`);
    if (!isJsonObject(message.result)) throw new Error("O servidor não retornou um resultado MCP.");
    return message.result;
  }

  async function listTools(): Promise<McpTool[]> {
    const discoverySignal = requestSignal();
    const initialized = await send("initialize", discoverySignal, {
      protocolVersion: PROTOCOL_VERSIONS[0],
      capabilities: {},
      clientInfo: { name: "Trudx", version: "1.0.0" },
    });
    if (typeof initialized.protocolVersion !== "string" || !PROTOCOL_VERSIONS.includes(initialized.protocolVersion))
      throw new Error("A versão do protocolo MCP do servidor é incompatível.");
    version = initialized.protocolVersion;
    await send("notifications/initialized", discoverySignal, undefined, true);

    const tools = new Map<string, McpTool>();
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await send("tools/list", discoverySignal, cursor ? { cursor } : undefined);
      if (!Array.isArray(result.tools)) throw new Error("O servidor não retornou ferramentas válidas.");
      for (const tool of result.tools) {
        if (
          isJsonObject(tool) &&
          typeof tool.name === "string" &&
          tool.name.length > 0 &&
          tool.name.length <= 128 &&
          isJsonObject(tool.inputSchema) &&
          tool.inputSchema.type === "object"
        )
          tools.set(tool.name, {
            name: tool.name,
            description: typeof tool.description === "string" ? tool.description.slice(0, 1000) : "",
            inputSchema: tool.inputSchema,
          });
        if (tools.size >= MAX_TOOLS) return [...tools.values()];
      }
      if (typeof result.nextCursor !== "string" || !result.nextCursor) return [...tools.values()];
      cursor = result.nextCursor;
    }
    return [...tools.values()];
  }

  const urlSecrets = [...new URL(url).searchParams.values()];
  const headerSecrets = Object.values(headers).flatMap((value) => [value, value.replace(/^Bearer /i, "")]);

  function requestSignal() {
    const timeout = AbortSignal.timeout(10000);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }

  return {
    listTools,
    async call(name: string, args: Record<string, unknown>) {
      const result = await send("tools/call", requestSignal(), { name, arguments: args });
      const secrets = [...urlSecrets, ...headerSecrets, sessionId ?? ""]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
      const cleaned = JSON.stringify(result, (_key, value: unknown) =>
        typeof value === "string"
          ? secrets.reduce(
              (text, secret) => (secret.length > 3 || text === secret ? text.replaceAll(secret, "[oculto]") : text),
              value,
            )
          : value,
      );
      return JSON.parse(cleaned) as Record<string, unknown>;
    },
    close() {
      if (!sessionId) return;
      void fetch(url, {
        method: "DELETE",
        headers: requestHeaders(),
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(3000),
      })
        .then((response) => response.body?.cancel())
        .catch(() => {});
    },
  };
}

export async function testCustomMcp(config: CustomMcpConfig, signal?: AbortSignal) {
  const session = openMcpSession(config, signal);
  try {
    return await session.listTools();
  } finally {
    session.close();
  }
}

export async function connectCustomMcpServers(servers: CustomMcpServer[], signal: AbortSignal) {
  const connected = await Promise.allSettled(
    servers
      .filter((server) => server.enabled_tools.length)
      .map(async (server) => {
        const session = openMcpSession(server, signal);
        try {
          const tools = await session.listTools();
          return {
            session,
            entries: await Promise.all(
              tools
                .filter((tool) => server.enabled_tools.includes(tool.name))
                .map(async (tool) => {
                  const bytes = new TextEncoder().encode(`${server.id}:${tool.name}`);
                  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
                  const suffix = [...digest.slice(0, 12)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
                  const name = `mcp_${tool.name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 34)}_${suffix}`;
                  const description = `Servidor ${server.name}, ferramenta ${tool.name}. ${tool.description}`;
                  return { tool: { ...tool, name, description }, remoteName: tool.name, session };
                }),
            ),
          };
        } catch (error) {
          session.close();
          throw error;
        }
      }),
  );
  const sessions = connected.flatMap((connection) => (connection.status === "fulfilled" ? [connection.value] : []));
  const entries = sessions.flatMap(({ entries }) => entries);
  const registry = new Map(entries.map((entry) => [entry.tool.name, entry]));
  return {
    tools: entries.map(({ tool }) => tool),
    failures: connected.length - sessions.length,
    call(name: string, args: Record<string, unknown>) {
      const entry = registry.get(name);
      return entry?.session.call(entry.remoteName, args);
    },
    close() {
      for (const { session } of sessions) session.close();
    },
  };
}
