export type BrowserLogLevel = "debug" | "info" | "warn" | "error";
export type BrowserLog = {
  id: string;
  timestamp: string;
  level: BrowserLogLevel;
  source: string;
  message: string;
  details?: string;
};

export const MAX_BROWSER_LOGS = 100;
export const BROWSER_LOGS_CHANGED = "trudx:browser-logs-changed";
const memory = new Map<string, BrowserLog[]>();
const secrets = new Set<string>();
const storageErrors = new Map<string, string>();
let activeOwner: string | null = null;

export function browserLogsKey(userId: string) {
  return `trudx:browser-logs:v1:${userId}`;
}

export function redactDiagnostic(value: unknown, extraSecrets: string[] = []): string {
  const seen = new WeakSet<object>();
  let text: string;
  try {
    text =
      typeof value === "string"
        ? value
        : value instanceof Error
          ? `${value.name}: ${value.message}\n${value.stack ?? ""}`
          : (JSON.stringify(value, (key, item: unknown) => {
              if (/authorization|api.?key|token|password|secret|cookie/i.test(key))
                return "[oculto]";
              if (item && typeof item === "object") {
                if (seen.has(item)) return "[circular]";
                seen.add(item);
              }
              return item;
            }) ?? String(value));
  } catch {
    text = "Não foi possível serializar o diagnóstico.";
  }
  for (const secret of [...secrets, ...extraSecrets]
    .filter((secret) => secret.length > 3)
    .sort((a, b) => b.length - a.length))
    text = text.split(secret).join("[oculto]");
  return text
    .replace(/Bearer\s+[^\s"',}]+/gi, "Bearer [oculto]")
    .replace(/\bsk-[\w-]+/g, "[oculto]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[oculto]")
    .replace(
      /((?:token|api[_-]?key|password|secret|authorization)\s*["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi,
      "$1[oculto]",
    )
    .replace(/https?:\/\/[^\s"<>]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 4000);
}

export function readBrowserLogs(userId: string): BrowserLog[] {
  if (memory.has(userId)) return memory.get(userId)!;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(browserLogsKey(userId)) ?? "[]");
    const logs = Array.isArray(raw)
      ? raw
          .filter((log): log is BrowserLog =>
            Boolean(
              log &&
                typeof log.id === "string" &&
                typeof log.timestamp === "string" &&
                ["debug", "info", "warn", "error"].includes(log.level) &&
                typeof log.source === "string" &&
                typeof log.message === "string",
            ),
          )
          .slice(-MAX_BROWSER_LOGS)
          .map((log) => ({
            ...log,
            message: redactDiagnostic(log.message),
            details: log.details ? redactDiagnostic(log.details) : undefined,
          }))
      : [];
    memory.set(userId, logs);
    return logs;
  } catch {
    const logs: BrowserLog[] = [];
    memory.set(userId, logs);
    return logs;
  }
}

function persist(userId: string, logs: BrowserLog[]) {
  memory.set(userId, logs);
  try {
    localStorage.setItem(browserLogsKey(userId), JSON.stringify(logs));
    storageErrors.delete(userId);
  } catch {
    storageErrors.set(
      userId,
      "O navegador bloqueou o armazenamento ou ficou sem espaço. Estes logs estão apenas na memória desta aba.",
    );
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(BROWSER_LOGS_CHANGED, { detail: userId }));
}

export function appendBrowserLog(
  userId: string,
  input: Pick<BrowserLog, "level" | "source" | "message"> & { details?: unknown },
) {
  if (!userId) return;
  const log: BrowserLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level: input.level,
    source: input.source.slice(0, 100),
    message: redactDiagnostic(input.message).slice(0, 1600),
    details: input.details === undefined ? undefined : redactDiagnostic(input.details),
  };
  persist(userId, [...readBrowserLogs(userId), log].slice(-MAX_BROWSER_LOGS));
}

export function clearBrowserLogs(userId: string) {
  persist(userId, []);
}
export function browserLogStorageError(userId: string) {
  return storageErrors.get(userId) ?? null;
}

export function createDiagnosticLogger() {
  const owner = activeOwner;
  return (input: Pick<BrowserLog, "level" | "source" | "message"> & { details?: unknown }) => {
    if (owner && owner === activeOwner) appendBrowserLog(owner, input);
  };
}

export function registerDiagnosticSecret(secret: string) {
  if (secret.trim()) secrets.add(secret.trim());
}

export function captureBrowserLogs(userId: string, token: string) {
  activeOwner = userId;
  registerDiagnosticSecret(token);
  const original = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };
  for (const method of Object.keys(original) as (keyof typeof original)[]) {
    console[method] = (...args: unknown[]) => {
      original[method].apply(console, args);
      if (activeOwner === userId)
        appendBrowserLog(userId, {
          level: method === "log" ? "info" : method,
          source: `console.${method}`,
          message: args.map((arg) => redactDiagnostic(arg)).join(" "),
        });
    };
  }
  const onError = (event: ErrorEvent) =>
    appendBrowserLog(userId, {
      level: "error",
      source: "window.error",
      message: event.message || "Falha ao carregar um recurso do navegador.",
      details: event.error ?? { file: event.filename, line: event.lineno, column: event.colno },
    });
  const onRejection = (event: PromiseRejectionEvent) =>
    appendBrowserLog(userId, {
      level: "error",
      source: "unhandledrejection",
      message: "Promise rejeitada sem tratamento",
      details: event.reason,
    });
  const onCsp = (event: SecurityPolicyViolationEvent) =>
    appendBrowserLog(userId, {
      level: "error",
      source: "securitypolicyviolation",
      message: `O navegador bloqueou ${event.violatedDirective}.`,
      details: { endpoint: event.blockedURI, policy: event.effectiveDirective },
    });
  const onOffline = () =>
    appendBrowserLog(userId, {
      level: "warn",
      source: "network",
      message: "O navegador ficou offline.",
    });
  const onOnline = () =>
    appendBrowserLog(userId, {
      level: "info",
      source: "network",
      message: "O navegador voltou a ficar online.",
    });
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("securitypolicyviolation", onCsp);
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  return () => {
    Object.assign(console, original);
    window.removeEventListener("error", onError, true);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("securitypolicyviolation", onCsp);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
    if (activeOwner === userId) {
      activeOwner = null;
      secrets.clear();
    }
  };
}

export function subscribeBrowserLogs(userId: string, listener: () => void) {
  function onChange(event: Event) {
    if ((event as CustomEvent<string>).detail === userId) listener();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === browserLogsKey(userId) || event.key === null) {
      memory.delete(userId);
      listener();
    }
  }
  window.addEventListener(BROWSER_LOGS_CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(BROWSER_LOGS_CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
