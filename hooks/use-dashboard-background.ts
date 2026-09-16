"use client";

//* Libraries Imports
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "trudx:dashboard-background";
const CHANGE_EVENT = "trudx:dashboard-background-change";

export const DASHBOARD_BACKGROUND_DEFAULT = true;

function readEnabled() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? DASHBOARD_BACKGROUND_DEFAULT : stored === "true";
  } catch {
    return DASHBOARD_BACKGROUND_DEFAULT;
  }
}

function subscribe(onChange: () => void) {
  // `storage` cobre outras abas; o evento próprio cobre a mesma aba, onde `storage` não dispara.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Preferência (por dispositivo) de mostrar a ilustração do período do dia no topo da visão geral. */
export function useDashboardBackground() {
  const isEnabled = useSyncExternalStore(subscribe, readEnabled, () => DASHBOARD_BACKGROUND_DEFAULT);

  const setEnabled = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Sem storage disponível: a escolha só não persiste.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { isEnabled, setEnabled };
}
