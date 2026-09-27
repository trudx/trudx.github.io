"use client";

//* Libraries Imports
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

//* Types Imports
import type {
  SystemHealthCheckState,
  SystemHealthInput,
  SystemHealthRecord,
} from "@/lib/system-health";

const STORAGE_KEY = "trudx:system-health:v1";
const CHECK_TIMEOUT_MS = 10_000;

type CheckResult = {
  id: string;
  url: string;
  isOnline: boolean;
  checkedAt: string;
};

function isSystemHealthRecord(value: unknown): value is SystemHealthRecord {
  if (!value || typeof value !== "object") return false;

  const record = value as Partial<SystemHealthRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.url === "string" &&
    typeof record.createdAt === "string" &&
    (typeof record.calculationStartedAt === "string" || record.calculationStartedAt === null) &&
    (typeof record.lastCheckedAt === "string" || record.lastCheckedAt === null)
  );
}

function readSystems() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isSystemHealthRecord) : [];
  } catch {
    toast.error("Não foi possível ler os sistemas salvos neste navegador.");
    return [];
  }
}

async function checkEndpoint(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: controller.signal,
    });

    return response.status === 200;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useSystemHealth() {
  const [systems, setSystems] = useState<SystemHealthRecord[]>([]);
  const [checkStates, setCheckStates] = useState<Record<string, SystemHealthCheckState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(0);
  const systemsRef = useRef<SystemHealthRecord[]>([]);
  const hasInitializedRef = useRef(false);

  const persistSystems = useCallback((nextSystems: SystemHealthRecord[]) => {
    systemsRef.current = nextSystems;
    setSystems(nextSystems);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSystems));
      return true;
    } catch {
      toast.error("Não foi possível salvar os sistemas neste navegador", {
        description: "As alterações ficam nesta sessão e podem se perder ao recarregar.",
      });
      return false;
    }
  }, []);

  const runChecks = useCallback(
    async (targets: SystemHealthRecord[]) => {
      if (targets.length === 0) return;

      setCheckStates((current) => ({
        ...current,
        ...Object.fromEntries(targets.map((system) => [system.id, "checking"] as const)),
      }));

      const results: CheckResult[] = await Promise.all(
        targets.map(async (system) => {
          const isOnline = await checkEndpoint(system.url);
          return {
            id: system.id,
            url: system.url,
            isOnline,
            checkedAt: new Date().toISOString(),
          };
        }),
      );
      const resultById = new Map(results.map((result) => [result.id, result] as const));

      const nextSystems = systemsRef.current.map((system) => {
        const result = resultById.get(system.id);
        if (!result || result.url !== system.url) return system;

        return result.isOnline
          ? {
              ...system,
              calculationStartedAt: system.calculationStartedAt ?? result.checkedAt,
              lastCheckedAt: result.checkedAt,
            }
          : {
              ...system,
              calculationStartedAt: null,
              lastCheckedAt: null,
            };
      });

      persistSystems(nextSystems);
      setNow(Date.now());
      setCheckStates((current) => {
        const next = { ...current };
        for (const result of results) {
          const currentSystem = systemsRef.current.find((system) => system.id === result.id);
          if (currentSystem?.url === result.url) {
            next[result.id] = result.isOnline ? "online" : "offline";
          }
        }
        return next;
      });
    },
    [persistSystems],
  );

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const storedSystems = readSystems();
    systemsRef.current = storedSystems;
    // localStorage só existe no navegador; estes estados inicializam a lista depois da hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystems(storedSystems);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckStates(
      Object.fromEntries(storedSystems.map((system) => [system.id, "checking"] as const)),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    void runChecks(storedSystems);
  }, [runChecks]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function createSystem(input: SystemHealthInput) {
    const system: SystemHealthRecord = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      url: input.url.trim(),
      createdAt: new Date().toISOString(),
      calculationStartedAt: null,
      lastCheckedAt: null,
    };

    const wasPersisted = persistSystems([...systemsRef.current, system]);
    void runChecks([system]);
    if (wasPersisted) toast.success("Sistema cadastrado");
    return true;
  }

  function updateSystem(id: string, input: SystemHealthInput) {
    const currentSystem = systemsRef.current.find((system) => system.id === id);
    if (!currentSystem) return false;

    const urlChanged = currentSystem.url !== input.url.trim();
    const updatedSystem: SystemHealthRecord = {
      ...currentSystem,
      name: input.name.trim(),
      url: input.url.trim(),
      ...(urlChanged ? { calculationStartedAt: null, lastCheckedAt: null } : {}),
    };

    const wasPersisted = persistSystems(
      systemsRef.current.map((system) => (system.id === id ? updatedSystem : system)),
    );
    if (urlChanged) void runChecks([updatedSystem]);
    if (wasPersisted) toast.success("Sistema atualizado");
    return true;
  }

  function importSystems(inputs: SystemHealthInput[]) {
    const existingUrls = new Set(systemsRef.current.map((system) => new URL(system.url).href));
    const importedSystems: SystemHealthRecord[] = [];
    const importedAt = new Date().toISOString();

    for (const input of inputs) {
      const url = new URL(input.url).href;
      if (existingUrls.has(url)) continue;

      existingUrls.add(url);
      importedSystems.push({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        url,
        createdAt: importedAt,
        calculationStartedAt: null,
        lastCheckedAt: null,
      });
    }

    if (importedSystems.length > 0) {
      persistSystems([...systemsRef.current, ...importedSystems]);
      void runChecks(importedSystems);
    }

    return {
      importedCount: importedSystems.length,
      skippedCount: inputs.length - importedSystems.length,
    };
  }

  function deleteSystem(id: string) {
    const wasPersisted = persistSystems(systemsRef.current.filter((system) => system.id !== id));
    setCheckStates((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (wasPersisted) toast.success("Sistema removido");
    return true;
  }

  return {
    systems,
    checkStates,
    isLoading,
    now,
    createSystem,
    updateSystem,
    importSystems,
    deleteSystem,
  };
}
