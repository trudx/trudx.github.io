//* Types Imports
import type { AiProviderId, AiSettings } from "./types";

export const AI_PROVIDERS = {
  openrouter: {
    name: "OpenRouter · vários provedores",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyUrl: "https://openrouter.ai/settings/keys",
    models: [
      { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5", vision: true },
      { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", vision: true },
      { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol", vision: true },
      { id: "openai/gpt-6-luna", name: "GPT-6 Luna", vision: true },
      { id: "google/gemini-4-argon", name: "Gemini 4 Argon", vision: true },
      { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", vision: true },
      { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", vision: false },
    ],
  },
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/responses",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", vision: true },
      { id: "gpt-6-luna", name: "GPT-6 Luna", vision: true },
      { id: "gpt-6-astra", name: "GPT-6 Astra", vision: true },
    ],
  },
  gemini: {
    name: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", vision: true },
      { id: "gemini-4-argon", name: "Gemini 4 Argon", vision: true },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", vision: true },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    keyUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-flash", name: "DeepSeek V4.1 Flash", vision: false },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", vision: false },
      { id: "deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision (exp.)", vision: true },
    ],
  },
} satisfies Record<
  AiProviderId,
  {
    name: string;
    endpoint: string;
    keyUrl: string;
    models: { id: string; name: string; vision: boolean }[];
  }
>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-5.5",
  token: "",
  tokens: {},
};

/** true/false para modelos do catálogo; null para um ID personalizado, que o provedor valida. */
export function modelAcceptsImages(settings: Pick<AiSettings, "provider" | "model">) {
  const model = AI_PROVIDERS[settings.provider].models.find(({ id }) => id === settings.model);
  return model ? model.vision : null;
}

export function modelName(settings: Pick<AiSettings, "provider" | "model">) {
  return (
    AI_PROVIDERS[settings.provider].models.find(({ id }) => id === settings.model)?.name ??
    settings.model
  );
}

/** Troca o provedor ativo usando o token já salvo dele (vazio se ainda não houver). */
export function switchAiProvider(
  settings: AiSettings,
  provider: AiProviderId,
  model = AI_PROVIDERS[provider].models[0].id,
): AiSettings {
  return { ...settings, provider, model, token: settings.tokens[provider] ?? "" };
}

function parseTokens(value: unknown) {
  const tokens: AiSettings["tokens"] = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return tokens;
  for (const [provider, token] of Object.entries(value)) {
    if (Object.hasOwn(AI_PROVIDERS, provider) && typeof token === "string" && token.trim())
      tokens[provider as AiProviderId] = token.trim();
  }
  return tokens;
}

export function parseAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_AI_SETTINGS };
  const data = value as Record<string, unknown>;
  if (typeof data.provider !== "string" || !Object.hasOwn(AI_PROVIDERS, data.provider)) {
    return { ...DEFAULT_AI_SETTINGS };
  }
  const provider = data.provider as AiProviderId;
  const tokens = parseTokens(data.tokens);
  // O token ativo vence o salvo no mapa: é o último que o usuário gravou para este provedor.
  const token = typeof data.token === "string" ? data.token.trim() : "";
  if (token) tokens[provider] = token;
  else delete tokens[provider];
  return {
    provider,
    model:
      typeof data.model === "string" && data.model.trim()
        ? data.model.trim()
        : AI_PROVIDERS[provider].models[0].id,
    token,
    tokens,
  };
}
