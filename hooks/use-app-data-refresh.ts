"use client";

//* Libraries Imports
import { useEffect } from "react";

export const APP_DATA_CHANGED = "trudx:app-data-changed";

export function notifyAppDataChanged(resource: string) {
  window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED, { detail: resource }));
}

export function useAppDataRefresh(refresh: () => Promise<unknown>, resources: string[]) {
  const key = resources.join(",");
  useEffect(() => {
    function handleChanged(event: Event) {
      if (key.split(",").includes((event as CustomEvent<string>).detail)) void refresh();
    }
    window.addEventListener(APP_DATA_CHANGED, handleChanged);
    return () => window.removeEventListener(APP_DATA_CHANGED, handleChanged);
  }, [refresh, key]);
}
