//* Libraries Imports
import { createAdminClient } from "@supabase/server/core";

//* Types Imports
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RpcLog } from "./protocol.ts";

//* Utils Imports
import { handleRpcMessage, inferAgentFromClient, normalizeAgent, RPC_ERRORS } from "./protocol.ts";
import { createSupabaseTaskStore } from "./store.ts";
import { todayIn } from "./tools.ts";

const TOKEN_PATTERN = /^trudx_[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 256_000;
/** Resultado guardado no log; acima disso fica só o começo, para a tabela não inchar. */
const MAX_LOGGED_RESULT_CHARS = 30_000;
const LOG_RETENTION_DAYS = 90;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, x-ia, x-client-info, apikey",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...headers },
  });
}

function rpcError(code: number, message: string, status: number) {
  return json({ jsonrpc: "2.0", id: null, error: { code, message } }, status);
}

/**
 * Header `Authorization: Bearer` quando o cliente permite (Claude Code, Cursor...). Conectores que
 * só aceitam uma URL (claude.ai, ChatGPT) mandam o token em `?token=`.
 */
function readToken(request: Request, url: URL) {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = bearer || url.searchParams.get("token")?.trim() || "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

async function findUserId(db: SupabaseClient, token: string) {
  const { data, error } = await db
    .from("mcp_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as { user_id: string } | null)?.user_id ?? null;
}

type SessionClient = { name: string | null; version: string | null; agent: string | null };

/** Cliente MCP da sessão, lido do log do `initialize` que a abriu. */
async function findSessionClient(
  db: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<SessionClient | null> {
  const { data } = await db
    .from("mcp_logs")
    .select("client_name,client_version,agent")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("method", "initialize")
    .limit(1)
    .maybeSingle();
  const row = data as {
    client_name: string | null;
    client_version: string | null;
    agent: string | null;
  } | null;
  return row ? { name: row.client_name, version: row.client_version, agent: row.agent } : null;
}

function truncateForLog(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = JSON.stringify(value);
  if (text.length <= MAX_LOGGED_RESULT_CHARS) return value;
  return { truncado: true, tamanho: text.length, inicio: text.slice(0, MAX_LOGGED_RESULT_CHARS) };
}

type RequestMeta = {
  userId: string;
  sessionId: string | null;
  session: SessionClient | null;
  declaredAgent: string | null;
  ip: string | null;
  userAgent: string | null;
};

function toLogRow(log: RpcLog, meta: RequestMeta, durationMs: number) {
  const clientName = log.clientInfo?.name ?? meta.session?.name ?? null;
  return {
    user_id: meta.userId,
    agent:
      log.agent ?? meta.declaredAgent ?? meta.session?.agent ?? inferAgentFromClient(clientName),
    agent_model: log.agentModel,
    client_name: clientName,
    client_version: log.clientInfo?.version ?? meta.session?.version ?? null,
    session_id: meta.sessionId,
    method: log.method,
    tool: log.tool,
    arguments: truncateForLog(log.arguments),
    result: truncateForLog(log.result),
    status: log.status,
    error: log.error,
    duration_ms: Math.max(0, Math.round(durationMs)),
    ip: meta.ip,
    user_agent: meta.userAgent?.slice(0, 300) ?? null,
  };
}

async function handlePost(request: Request, url: URL) {
  const token = readToken(request, url);
  if (!token)
    return rpcError(
      RPC_ERRORS.invalidRequest,
      "Token ausente ou inválido. Gere um no painel do trudx.",
      401,
    );

  const db = createAdminClient();
  const userId = await findUserId(db, token);
  if (!userId)
    return rpcError(
      RPC_ERRORS.invalidRequest,
      "Token revogado ou inexistente. Gere um novo no painel do trudx.",
      401,
    );

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES)
    return rpcError(RPC_ERRORS.invalidRequest, "Requisição grande demais.", 413);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
      return rpcError(RPC_ERRORS.invalidRequest, "Requisição grande demais.", 413);
    body = JSON.parse(text);
  } catch {
    return rpcError(RPC_ERRORS.parse, "JSON inválido.", 400);
  }

  const headerSession = request.headers.get("mcp-session-id");
  let sessionId = headerSession && UUID_PATTERN.test(headerSession) ? headerSession : null;
  const meta: RequestMeta = {
    userId,
    sessionId,
    session: sessionId ? await findSessionClient(db, userId, sessionId) : null,
    declaredAgent: normalizeAgent(request.headers.get("x-ia") ?? url.searchParams.get("ia")),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };

  const context = { store: createSupabaseTaskStore(db, userId), today: todayIn() };
  const messages = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];
  const logRows: ReturnType<typeof toLogRow>[] = [];

  for (const message of messages) {
    const startedAt = performance.now();
    const outcome = await handleRpcMessage(message, context);
    if (outcome.initialized) {
      // Cada initialize abre uma sessão nova; o id volta no header e amarra as próximas chamadas.
      sessionId = crypto.randomUUID();
      meta.sessionId = sessionId;
      meta.session = null;
    }
    if (outcome.log) logRows.push(toLogRow(outcome.log, meta, performance.now() - startedAt));
    if (outcome.response) responses.push(outcome.response);
  }

  if (logRows.length) {
    const { error } = await db.from("mcp_logs").insert(logRows);
    if (error) console.error("Could not write MCP logs", error.message);
  }
  if (logRows.some((row) => row.method === "initialize")) {
    const retention = new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000).toISOString();
    const { error } = await db
      .from("mcp_logs")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", retention);
    if (error) console.error("Could not clean old MCP logs", error.message);
  }

  const headers: Record<string, string> = sessionId ? { "Mcp-Session-Id": sessionId } : {};
  if (!responses.length)
    return new Response(null, { status: 202, headers: { ...CORS_HEADERS, ...headers } });
  return json(Array.isArray(body) ? responses : responses[0], 200, headers);
}

const mcpServer = {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    // Servidor sem estado: não abre stream SSE nem guarda sessão para encerrar.
    if (request.method !== "POST")
      return json({ error: "Use POST com JSON-RPC (MCP Streamable HTTP)." }, 405, {
        Allow: "POST, OPTIONS",
      });

    try {
      return await handlePost(request, url);
    } catch (error) {
      console.error("MCP request failed", {
        message: error instanceof Error ? error.message : "unknown error",
      });
      return rpcError(RPC_ERRORS.internal, "Falha interna no MCP.", 500);
    }
  },
};

export default mcpServer;
