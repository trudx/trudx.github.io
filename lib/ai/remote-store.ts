//* Services Imports
import { supabase } from "@/hooks/supabase";

//* Types Imports
import type { AiSettings } from "./types";
import type { SavedAiChat } from "./chat-store";

//* Utils Imports
import { parseAiSettings } from "./models";
import { MAX_SAVED_CHATS, parseSavedAiChat } from "./chat-store";

const SETTINGS_TABLE = "ai_configuracoes";
const CHATS_TABLE = "ai_conversas";

type ChatRow = {
  id: string;
  titulo: string;
  entradas: unknown;
  created_at: string;
  updated_at: string;
};

/** Configuração da IA salva na conta, ou null quando ainda não existe. */
export async function fetchRemoteAiSettings(userId: string): Promise<AiSettings | null> {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select("provider,model,token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.token) return null;
  return parseAiSettings(data);
}

export async function pushRemoteAiSettings(userId: string, settings: AiSettings) {
  const { error } = await supabase.from(SETTINGS_TABLE).upsert({
    user_id: userId,
    provider: settings.provider,
    model: settings.model.trim(),
    token: settings.token.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteRemoteAiSettings(userId: string) {
  const { error } = await supabase.from(SETTINGS_TABLE).delete().eq("user_id", userId);
  if (error) throw error;
}

/** Últimas conversas da conta; linhas que não passam no schema são descartadas. */
export async function fetchRemoteChats(userId: string): Promise<SavedAiChat[]> {
  const { data, error } = await supabase
    .from(CHATS_TABLE)
    .select("id,titulo,entradas,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_SAVED_CHATS);
  if (error) throw error;
  return ((data ?? []) as ChatRow[]).flatMap((row) => {
    const chat = parseSavedAiChat({
      id: row.id,
      title: row.titulo,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      entries: row.entradas,
    });
    return chat ? [chat] : [];
  });
}

export async function pushRemoteChat(userId: string, chat: SavedAiChat) {
  const { error } = await supabase.from(CHATS_TABLE).upsert({
    id: chat.id,
    user_id: userId,
    titulo: chat.title,
    entradas: chat.entries,
    created_at: chat.createdAt,
    updated_at: chat.updatedAt,
  });
  if (error) throw error;

  // Mantém na conta o mesmo limite do histórico local.
  const { data: older, error: listError } = await supabase
    .from(CHATS_TABLE)
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(MAX_SAVED_CHATS, MAX_SAVED_CHATS + 99);
  if (listError) throw listError;
  if (older?.length) {
    const { error: pruneError } = await supabase
      .from(CHATS_TABLE)
      .delete()
      .eq("user_id", userId)
      .in(
        "id",
        older.map((row) => row.id),
      );
    if (pruneError) throw pruneError;
  }
}

export async function deleteRemoteChat(userId: string, id: string) {
  const { error } = await supabase.from(CHATS_TABLE).delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
