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

  useEffect(
    () => (userId ? captureBrowserLogs(userId, settings.token) : undefined),
    [userId, settings.token],
  );

  function saveSettings(next: AiSettings) {
    if (!userId) throw new Error("Sua sessão expirou. Entre novamente.");
    writeAiSettings(userId, next);
    setSettings({ ...next, token: next.token.trim(), model: next.model.trim() });
  }

  function clearSettings() {
    if (userId) localStorage.removeItem(aiStorageKey(userId));
    setSettings({ ...DEFAULT_AI_SETTINGS });
  }

  return (
    <AiContext.Provider value={{ userId, settings, isLoading, saveSettings, clearSettings }}>
      {children}
    </AiContext.Provider>
  );
}
