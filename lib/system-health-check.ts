//* Types Imports
import type { SystemHealthCheckState } from "@/lib/system-health";

export type SystemHealthEndpointResult = {
  state: Exclude<SystemHealthCheckState, "checking">;
  detail: string;
};

export async function checkSystemHealthEndpoint(url: string): Promise<SystemHealthEndpointResult> {
  if (window.location.protocol === "https:" && new URL(url).protocol === "http:") {
    return { state: "unverified", detail: "Use HTTPS: o navegador bloqueia HTTP nesta página." };
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.type === "opaqueredirect" || response.status === 0) {
      return { state: "unverified", detail: "A URL redireciona. Cadastre a rota pública final que responde 200." };
    }
    return {
      state: response.status === 200 ? "online" : "offline",
      detail: "HTTP " + response.status,
    };
  } catch {
    return {
      state: "unverified",
      detail: controller.signal.aborted
        ? "Sem resposta em 10 segundos. Tente novamente."
        : "O navegador não conseguiu consultar a URL. Confira CORS para " +
          window.location.origin +
          ", conexão e certificado HTTPS.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
