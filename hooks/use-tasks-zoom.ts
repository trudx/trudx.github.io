"use client";

//* Libraries Imports
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "trudx:tasks-zoom";
const CHANGE_EVENT = "trudx:tasks-zoom-change";
const DESKTOP_QUERY = "(min-width: 48rem)";

export const TASKS_ZOOM_DEFAULT = 75;
export const TASKS_ZOOM_OPTIONS = [50, 60, 67, 75, 80, 90, 100] as const;

function readZoom() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return TASKS_ZOOM_OPTIONS.includes(stored as (typeof TASKS_ZOOM_OPTIONS)[number]) ? stored : TASKS_ZOOM_DEFAULT;
  } catch {
    return TASKS_ZOOM_DEFAULT;
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

export function useTasksZoom() {
  const zoom = useSyncExternalStore(subscribe, readZoom, () => TASKS_ZOOM_DEFAULT);

  const setZoom = useCallback((value: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Sem storage (aba anônima bloqueada): o valor só não persiste.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { zoom, setZoom };
}

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * Fator de escala efetivo do corpo da aba Tarefas (ex.: 0.75). No celular é sempre 1: lá o Kanban
 * já é pensado para a tela pequena e o zoom não é aplicado.
 */
export function useTasksZoomScale() {
  const { zoom } = useTasksZoom();
  const isDesktop = useSyncExternalStore(subscribeDesktop, readDesktop, () => false);
  return isDesktop ? zoom / 100 : 1;
}
