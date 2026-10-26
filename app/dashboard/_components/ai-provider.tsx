"use client";

//* Libraries Imports
import { useEffect, useState } from "react";

//* Services Imports
import { supabase } from "@/hooks/supabase";

//* Types Imports
import type { ReactNode } from "react";
import type { AiSettings } from "@/lib/ai/types";

//* Utils Imports
import { AiContext } from "@/lib/ai/context";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai/models";
import { aiStorageKey, readAiSettings, writeAiSettings } from "@/lib/ai/settings-store";
import { mergeRemoteAiChats, readAiChats } from "@/lib/ai/chat-store";
import {
  deleteRemoteAiSettings,
  fetchRemoteAiSettings,
  fetchRemoteChats,
  pushRemoteAiSettings,
  pushRemoteChat,
} from "@/lib/ai/remote-store";
import { getApiErrorMessage } from "@/lib/api-error";
import { captureBrowserLogs } from "@/lib/browser-logs";

export function AiProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AiSettings>({ ...DEFAULT_AI_SETTINGS });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    function loadAccount(id: string | null) {
      if (!active) return;
      setUserId(id);
      setSettings(id ? readAiSettings(id) : { ...DEFAULT_AI_SETTINGS });
      setIsLoading(false);
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      loadAccount(session?.user.id ?? null);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!authChanged) loadAccount(data.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (userId && (event.key === aiStorageKey(userId) || event.key === null)) {
        setSettings(readAiSettings(userId));
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId]);

  // A conta é a fonte da verdade: traz configuração e conversas de outros dispositivos e, na
  // primeira vez, sobe o que só existia neste navegador.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function syncAccount(id: string) {
      try {
        // Garante um access token válido (renova se vencido) antes de falar com o banco.
        await supabase.auth.getUser();
        const remoteSettings = await fetchRemoteAiSettings(id);
        if (!active) return;
        if (remoteSettings) {
          writeAiSettings(id, remoteSettings);
          setSettings(remoteSettings);
        } else {
          const local = readAiSettings(id);
          if (local.token) await pushRemoteAiSettings(id, local);
        }

        const remoteChats = await fetchRemoteChats(id);
        if (!active) return;
        if (remoteChats.length === 0) {
          for (const chat of readAiChats(id)) await pushRemoteChat(id, chat);
        } else {
          mergeRemoteAiChats(id, remoteChats);
        }
      } catch (error) {
        console.error("Erro ao sincronizar a IA com a conta:", error);
      }
    }
    void syncAccount(userId);
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(
    () => (userId ? captureBrowserLogs(userId, settings.token) : undefined),
    [userId, settings.token],
  );

  async function saveSettings(next: AiSettings) {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente.");
    writeAiSettings(userId, next);
    setSettings({ ...next, token: next.token.trim(), model: next.model.trim() });
    try {
      await pushRemoteAiSettings(userId, next);
    } catch (error) {
      console.error("Erro ao salvar a configuração da IA na conta:", error);
      throw new Error(
        `Salvo só neste navegador: não foi possível gravar na sua conta. ${getApiErrorMessage(error, "Erro desconhecido.")}`,
      );
    }
  }

  async function clearSettings() {
    if (userId) localStorage.removeItem(aiStorageKey(userId));
    setSettings({ ...DEFAULT_AI_SETTINGS });
    if (!userId) return;
    try {
      await deleteRemoteAiSettings(userId);
    } catch (error) {
      console.error("Erro ao remover a configuração da IA da conta:", error);
      throw new Error("Removido deste navegador, mas não foi possível remover da sua conta.");
    }
  }

  return (
    <AiContext.Provider value={{ userId, settings, isLoading, saveSettings, clearSettings }}>
      {children}
    </AiContext.Provider>
  );
}
