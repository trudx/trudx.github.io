export type AiProviderId = "openrouter" | "openai" | "gemini" | "deepseek";

export type AiSettings = {
  provider: AiProviderId;
  model: string;
  /** Token do provedor ativo; o mesmo valor de `tokens[provider]`. */
  token: string;
  /** Tokens salvos por provedor, para trocar de provedor sem colar a chave de novo. */
  tokens: Partial<Record<AiProviderId, string>>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  [key: string]: unknown;
};

export type AiMessage = {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /** Imagens da mensagem do usuário como data URL; não são salvas no histórico. */
  images?: string[];
  [key: string]: unknown;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint: boolean; destructiveHint?: boolean };
};

export type ToolActivity = {
  id: string;
  name: string;
  status: "running" | "success" | "error";
  detail?: string;
};

export type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  activities?: ToolActivity[];
  error?: boolean;
  /** Só existe na sessão atual; o histórico salvo guarda apenas `imageCount`. */
  images?: string[];
  imageCount?: number;
};
