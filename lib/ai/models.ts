//* Types Imports
import type { AiProviderId, AiSettings } from "./types";

export const AI_PROVIDERS = {
  openrouter: {
    name: "OpenRouter · vários provedores",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyUrl: "https://openrouter.ai/settings/keys",
    models: [
      { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5" },
      { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5" },
      { id: "openai/gpt-6.1-sol", name: "GPT-6.1 Sol" },
      { id: "openai/gpt-6-luna", name: "GPT-6 Luna" },
      { id: "google/gemini-4-argon", name: "Gemini 4 Argon" },
      { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
    ],
  },
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/responses",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
      { id: "gpt-6-luna", name: "GPT-6 Luna" },
      { id: "gpt-6-astra", name: "GPT-6 Astra" },
    ],
  },
  gemini: {
    name: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "gemini-4-argon", name: "Gemini 4 Argon" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    keyUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-flash", name: "DeepSeek V4.1 Flash" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    ],
  },
} satisfies Record<
  AiProviderId,
  { name: string; endpoint: string; keyUrl: string; models: { id: string; name: string }[] }
>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-5.5",
  token: "",
};

export function parseAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_AI_SETTINGS };
  const data = value as Record<string, unknown>;
  if (typeof data.provider !== "string" || !Object.hasOwn(AI_PROVIDERS, data.provider)) {
    return { ...DEFAULT_AI_SETTINGS };
  }
  const provider = data.provider as AiProviderId;
  return {
    provider,
    model:
      typeof data.model === "string" && data.model.trim()
        ? data.model.trim()
        : AI_PROVIDERS[provider].models[0].id,
    token: typeof data.token === "string" ? data.token.trim() : "",
  };
}
