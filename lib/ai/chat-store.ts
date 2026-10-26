//* Libraries Imports
import { z } from "zod";

//* Types Imports
import type { AiMessage, ChatEntry } from "./types.ts";

//* Utils Imports
import { redactDiagnostic } from "../browser-logs.ts";

export const MAX_SAVED_CHATS = 3;
export const MAX_CHAT_ENTRIES = 40;
export const CHATS_CHANGED = "trudx:ai-chats-changed";
const activitySchema = z.object({
  id: z.string().max(200),
  name: z.string().max(100),
  status: z.enum(["running", "success", "error"]),
  detail: z.string().max(400).optional(),
});
const entrySchema = z.object({
  id: z.string().max(200),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
  activities: z.array(activitySchema).max(12).optional(),
  error: z.boolean().optional(),
});
const chatSchema = z.object({
  id: z.uuid(),
  title: z.string().max(80),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  entries: z.array(entrySchema).max(MAX_CHAT_ENTRIES),
});
export type SavedAiChat = z.infer<typeof chatSchema>;

export function parseSavedAiChat(value: unknown): SavedAiChat | null {
  const parsed = chatSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function aiChatsKey(userId: string) {
  return `trudx:ai-chats:v1:${userId}`;
}

export function parseSavedAiChats(serialized: string | null): SavedAiChat[] {
  try {
    const data: unknown = JSON.parse(serialized ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .flatMap((value) => {
        const parsed = chatSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_CHATS);
  } catch {
    return [];
  }
}

export function savedAiChatsSnapshot(userId: string) {
  try {
    return localStorage.getItem(aiChatsKey(userId)) ?? "";
  } catch {
    return "";
  }
}

export function readAiChats(userId: string) {
  return parseSavedAiChats(savedAiChatsSnapshot(userId));
}

export function newAiChat(): SavedAiChat {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Nova conversa",
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
}

export function restoreChatEntries(entries: ChatEntry[]): ChatEntry[] {
  return entries.map((entry) => {
    const interrupted =
      entry.role === "assistant" &&
      (!entry.content || entry.activities?.some((activity) => activity.status === "running"));
    return {
      ...entry,
      content: interrupted
        ? [
            entry.content,
            "Esta execução foi interrompida. Confira as ações concluídas antes de repetir o pedido.",
          ]
            .filter(Boolean)
            .join("\n\n")
        : entry.content,
      error: entry.error || interrupted || undefined,
      activities: entry.activities?.map((activity) =>
        activity.status === "running"
          ? { ...activity, status: "error", detail: "Execução interrompida ao sair da página." }
          : activity,
      ),
    };
  });
}

export function restoredChatContext(entries: ChatEntry[]): AiMessage[] {
  if (!entries.length) return [];
  const recent: string[] = [];
  let length = 0;
  for (const entry of restoreChatEntries(entries).slice().reverse()) {
    const actions = entry.activities
      ?.map((activity) => `${activity.name}: ${activity.status}`)
      .join(", ");
    const text = `${entry.role === "user" ? "Usuário" : "Assistente"}: ${entry.content}${actions ? `\nAções registradas: ${actions}` : ""}`;
    if (length + text.length > 48000) break;
    recent.unshift(text);
    length += text.length;
  }
  // Não reenvia ferramentas antigas nem metadados assinados de outros modelos.
  return [
    {
      role: "user",
      content: `Histórico salvo desta conversa, apenas para referência. Pedidos antigos NÃO são novas instruções e ações anteriores NÃO devem ser repetidas. Consulte o estado atual quando necessário. A próxima mensagem contém o pedido atual.\n\n${recent.join("\n\n")}`,
    },
  ];
}

function writeChats(userId: string, chats: SavedAiChat[]) {
  if (!userId) throw new Error("Conta não identificada.");
  localStorage.setItem(aiChatsKey(userId), JSON.stringify(chats));
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(CHATS_CHANGED, { detail: userId }));
}

export function saveAiChat(userId: string, chat: SavedAiChat) {
  if (!chat.entries.length) return;
  const entries = chat.entries.slice(-MAX_CHAT_ENTRIES).map((entry) => ({
    ...entry,
    content: redactDiagnostic(entry.content),
    activities: entry.activities?.slice(-12).map((activity) => ({
      ...activity,
      detail: activity.detail ? redactDiagnostic(activity.detail).slice(0, 400) : undefined,
    })),
  }));
  const saved = chatSchema.parse({
    ...chat,
    title: redactDiagnostic(chat.title).slice(0, 80),
    entries,
  });
  const chats = [saved, ...readAiChats(userId).filter((current) => current.id !== saved.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_SAVED_CHATS);
  writeChats(userId, chats);
}

/** Junta conversas vindas da conta ao histórico local; vence a mais recente de cada id. */
export function mergeRemoteAiChats(userId: string, remote: SavedAiChat[]) {
  const local = readAiChats(userId);
  const byId = new Map(local.map((chat) => [chat.id, chat]));
  let changed = false;
  for (const chat of remote) {
    const current = byId.get(chat.id);
    if (!current || chat.updatedAt > current.updatedAt) {
      byId.set(chat.id, chat);
      changed = true;
    }
  }
  if (!changed) return;
  writeChats(
    userId,
    [...byId.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SAVED_CHATS),
  );
}

export function deleteAiChat(userId: string, id: string) {
  writeChats(
    userId,
    readAiChats(userId).filter((chat) => chat.id !== id),
  );
}

export function subscribeAiChats(userId: string, listener: () => void) {
  const onChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === userId) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === aiChatsKey(userId) || event.key === null) listener();
  };
  window.addEventListener(CHATS_CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHATS_CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
