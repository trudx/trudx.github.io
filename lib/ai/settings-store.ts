//* Types Imports
import type { AiSettings } from "./types";

//* Utils Imports
import { DEFAULT_AI_SETTINGS, parseAiSettings } from "./models.ts";

export function aiStorageKey(userId: string) {
  return `trudx:ai-settings:v1:${userId}`;
}

export function readAiSettings(userId: string): AiSettings {
  try {
    return parseAiSettings(JSON.parse(localStorage.getItem(aiStorageKey(userId)) ?? "null"));
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function writeAiSettings(userId: string, settings: AiSettings) {
  if (!userId) throw new Error("Entre na sua conta para salvar a configuração.");
  localStorage.setItem(aiStorageKey(userId), JSON.stringify(parseAiSettings(settings)));
}
