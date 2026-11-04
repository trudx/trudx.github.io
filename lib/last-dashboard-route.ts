const STORAGE_KEY = "trudx:last-dashboard-route";

/** Última aba do dashboard aberta neste dispositivo, para reabrir direto nela ao voltar ao site. */
export function readLastDashboardRoute() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored?.startsWith("/dashboard") ? stored : null;
  } catch {
    return null;
  }
}

export function saveLastDashboardRoute(pathname: string) {
  if (!pathname.startsWith("/dashboard")) return;

  try {
    localStorage.setItem(STORAGE_KEY, pathname);
  } catch {
    // Sem storage disponível: o site só não lembra a última aba.
  }
}
