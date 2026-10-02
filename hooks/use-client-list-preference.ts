"use client";

//* Libraries Imports
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "trudx:clients-only-active";
const CHANGE_EVENT = "trudx:clients-only-active-change";

export const CLIENTS_ONLY_ACTIVE_DEFAULT = true;

function readOnlyActive() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? CLIENTS_ONLY_ACTIVE_DEFAULT : stored === "true";
  } catch {
    return CLIENTS_ONLY_ACTIVE_DEFAULT;
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

/** Preferência (por dispositivo) de listar só clientes ativos nos seletores de cliente. */
export function useClientListPreference() {
  const onlyActive = useSyncExternalStore(
    subscribe,
    readOnlyActive,
    () => CLIENTS_ONLY_ACTIVE_DEFAULT,
  );

  const setOnlyActive = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Sem storage disponível: a escolha só não persiste.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { onlyActive, setOnlyActive };
}
