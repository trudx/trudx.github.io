export type SystemHealthRecord = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  calculationStartedAt: string | null;
  lastCheckedAt: string | null;
};

export type SystemHealthInput = Pick<SystemHealthRecord, "name" | "url">;

export type SystemHealthCheckState = "checking" | "online" | "offline" | "unverified";

const SYSTEM_HEALTH_CONFIG_FORMAT = "trudx-system-health-config";
const SYSTEM_HEALTH_CONFIG_VERSION = 1;

export function createSystemHealthConfig(systems: SystemHealthInput[]) {
  return JSON.stringify(
    {
      format: SYSTEM_HEALTH_CONFIG_FORMAT,
      version: SYSTEM_HEALTH_CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      systems: systems.map(({ name, url }) => ({ name, url })),
    },
    null,
    2,
  );
}

export function parseSystemHealthConfig(value: unknown): SystemHealthInput[] {
  if (!value || typeof value !== "object") {
    throw new Error("O arquivo não contém uma configuração JSON válida.");
  }

  const config = value as Record<string, unknown>;
  if (
    config.format !== SYSTEM_HEALTH_CONFIG_FORMAT ||
    config.version !== SYSTEM_HEALTH_CONFIG_VERSION ||
    !Array.isArray(config.systems)
  ) {
    throw new Error("Esse arquivo não é uma exportação de Saúde de sistemas do trudx.");
  }

  return config.systems.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`O sistema ${index + 1} não tem um formato válido.`);
    }

    const system = value as Record<string, unknown>;
    if (typeof system.name !== "string" || !system.name.trim() || system.name.trim().length > 100) {
      throw new Error(`O sistema ${index + 1} precisa ter um nome de até 100 caracteres.`);
    }
    if (typeof system.url !== "string") {
      throw new Error(`O sistema ${index + 1} precisa ter uma URL.`);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(system.url.trim());
    } catch {
      throw new Error(`A URL do sistema ${index + 1} é inválida.`);
    }

    if (
      (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      throw new Error(`A URL do sistema ${index + 1} precisa ser HTTP ou HTTPS e não conter credenciais.`);
    }

    return {
      name: system.name.trim(),
      url: parsedUrl.toString(),
    };
  });
}

export function getSystemHealthDays(startedAt: string | null, now: number) {
  if (!startedAt) return 0;

  const elapsed = now - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;

  return Math.floor(elapsed / 86_400_000);
}

export function formatSystemHealthDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
