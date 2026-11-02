"use client";

//* Libraries Imports
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

//* Services Imports
import { get, patch, post, remove, upsert, upsertIgnoring } from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type {
  SystemHealthCheckState,
  SystemHealthInput,
  SystemHealthRecord,
} from "@/lib/system-health";

//* Utils Imports
import { getApiErrorMessage, isUniqueViolation } from "@/lib/api-error";
import { checkSystemHealthEndpoint } from "@/lib/system-health-check";

const TABLE = "system_health_systems";
const SELECT_COLUMNS = "id,name,url,calculation_started_at,last_checked_at,created_at";
/** Onde os sistemas ficavam antes de irem pro banco. Lido só pra migrar e apagado depois. */
const LEGACY_STORAGE_KEY = "trudx:system-health:v1";

type SystemHealthRow = {
  id: string;
  name: string;
  url: string;
  calculation_started_at: string | null;
  last_checked_at: string | null;
  created_at: string;
};

type CheckResult = {
  id: string;
  url: string;
  state: Exclude<SystemHealthCheckState, "checking">;
  detail: string;
  checkedAt: string;
};

function toRecord(row: SystemHealthRow): SystemHealthRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    createdAt: row.created_at,
    calculationStartedAt: row.calculation_started_at,
    lastCheckedAt: row.last_checked_at,
  };
}

function toRow(system: SystemHealthRecord, userId: string) {
  return {
    id: system.id,
    user_id: userId,
    name: system.name,
    url: system.url,
    calculation_started_at: system.calculationStartedAt,
    last_checked_at: system.lastCheckedAt,
    created_at: system.createdAt,
  };
}

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

function readLegacySystems() {
  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isSystemHealthRecord) : [];
  } catch {
    return [];
  }
}

/**
 * Leva pro banco o que estava salvo só neste navegador. A chave local só é apagada depois que o
 * banco confirma; se falhar, ela fica e a migração tenta de novo na próxima visita. URL que já
 * existe na conta é ignorada (constraint user_id + url).
 */
async function migrateLegacySystems(userId: string) {
  const legacySystems = readLegacySystems();
  if (legacySystems.length === 0) return;

  // Só o que o banco aceita: URL inválida faria o envio inteiro falhar a cada visita.
  const validSystems = legacySystems.filter(
    (system) => /^https?:\/\//i.test(system.url) && system.name.trim(),
  );
  if (validSystems.length === 0) return;

  try {
    // O id local fica pra trás e o banco gera um uuid novo: o antigo não tem garantia de ser único.
    const inserted = await upsertIgnoring<SystemHealthRow>(
      TABLE,
      validSystems.map((system) => ({
        user_id: userId,
        name: system.name.trim().slice(0, 100),
        url: system.url,
        calculation_started_at: system.calculationStartedAt,
        last_checked_at: system.lastCheckedAt,
        created_at: system.createdAt,
      })),
      { onConflict: "user_id,url", select: "id" },
    );
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (inserted.length > 0)
      toast.success(
        `${inserted.length} ${inserted.length === 1 ? "sistema salvo" : "sistemas salvos"} na sua conta`,
        {
          description: "Os sistemas que estavam só neste navegador agora ficam salvos no trudx.",
        },
      );
  } catch (error) {
    toast.error("Não foi possível enviar os sistemas deste navegador para a sua conta", {
      description: getApiErrorMessage(
        error,
        "Eles continuam aqui e serão enviados na próxima visita.",
      ),
    });
    console.error("Erro ao migrar sistemas do localStorage:", error);
  }
}

export function useSystemHealth() {
  const [systems, setSystems] = useState<SystemHealthRecord[]>([]);
  const [checkStates, setCheckStates] = useState<Record<string, SystemHealthCheckState>>({});
  const [checkDetails, setCheckDetails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(0);
  const systemsRef = useRef<SystemHealthRecord[]>([]);
  const hasInitializedRef = useRef(false);

  const replaceSystems = useCallback((nextSystems: SystemHealthRecord[]) => {
    systemsRef.current = nextSystems;
    setSystems(nextSystems);
  }, []);

  /** Grava o resultado das checagens (início da contagem e última checagem) numa requisição só. */
  const saveCheckResults = useCallback(async (changedSystems: SystemHealthRecord[]) => {
    if (changedSystems.length === 0) return;

    try {
      const userId = await getAuthenticatedUserId();
      await upsert(
        TABLE,
        changedSystems.map((system) => toRow(system, userId)),
        { onConflict: "id", select: "id" },
      );
    } catch (error) {
      toast.error("Não foi possível salvar o resultado das verificações", {
        description: getApiErrorMessage(error, "A contagem será recalculada na próxima visita."),
      });
      console.error("Erro ao salvar checagens de saúde de sistemas:", error);
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
          const result = await checkSystemHealthEndpoint(system.url);
          return {
            id: system.id,
            url: system.url,
            ...result,
            checkedAt: new Date().toISOString(),
          };
        }),
      );
      const resultById = new Map(results.map((result) => [result.id, result] as const));
      const changedSystems: SystemHealthRecord[] = [];

      const nextSystems = systemsRef.current.map((system) => {
        const result = resultById.get(system.id);
        // URL trocada enquanto a checagem rodava: o resultado é da URL antiga e não vale.
        if (!result || result.url !== system.url) return system;

        const nextSystem =
          result.state === "online"
            ? {
                ...system,
                calculationStartedAt: system.calculationStartedAt ?? result.checkedAt,
                lastCheckedAt: result.checkedAt,
              }
            : { ...system, calculationStartedAt: null, lastCheckedAt: null };
        if (
          nextSystem.calculationStartedAt !== system.calculationStartedAt ||
          nextSystem.lastCheckedAt !== system.lastCheckedAt
        )
          changedSystems.push(nextSystem);
        return nextSystem;
      });

      setCheckDetails((current) => {
        const next = { ...current };
        for (const result of results) {
          if (
            systemsRef.current.some(
              (system) => system.id === result.id && system.url === result.url,
            )
          ) {
            next[result.id] = result.detail;
          }
        }
        return next;
      });
      replaceSystems(nextSystems);
      setNow(Date.now());
      setCheckStates((current) => {
        const next = { ...current };
        for (const result of results) {
          const currentSystem = systemsRef.current.find((system) => system.id === result.id);
          if (currentSystem?.url === result.url) {
            next[result.id] = result.state;
          }
        }
        return next;
      });
      await saveCheckResults(changedSystems);
    },
    [replaceSystems, saveCheckResults],
  );

  const loadSystems = useCallback(async () => {
    try {
      const userId = await getAuthenticatedUserId();
      await migrateLegacySystems(userId);
      const rows = await get<SystemHealthRow>(TABLE, {
        select: SELECT_COLUMNS,
        filters: { user_id: userId },
        order: [
          { column: "created_at", ascending: true },
          { column: "id", ascending: true },
        ],
      });
      const loadedSystems = rows.map(toRecord);
      replaceSystems(loadedSystems);
      setCheckStates(
        Object.fromEntries(loadedSystems.map((system) => [system.id, "checking"] as const)),
      );
      setNow(Date.now());
      void runChecks(loadedSystems);
    } catch (error) {
      toast.error("Não foi possível carregar os sistemas", {
        description: getApiErrorMessage(error, "Tente atualizar a página novamente."),
      });
      console.error("Erro ao listar saúde de sistemas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [replaceSystems, runChecks]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    // A migração lê o localStorage, que só existe no navegador; por isso a carga fica no efeito.
    void loadSystems();
  }, [loadSystems]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function showSaveError(error: unknown, title: string) {
    toast.error(isUniqueViolation(error) ? "Essa URL já está cadastrada" : title, {
      description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
    });
  }

  async function createSystem(input: SystemHealthInput) {
    try {
      const userId = await getAuthenticatedUserId();
      const [created] = await post<SystemHealthRow>(
        TABLE,
        { user_id: userId, name: input.name.trim(), url: input.url.trim() },
        { select: SELECT_COLUMNS },
      );
      if (!created) return false;

      const system = toRecord(created);
      replaceSystems([...systemsRef.current, system]);
      void runChecks([system]);
      toast.success("Sistema cadastrado");
      return true;
    } catch (error) {
      showSaveError(error, "Não foi possível cadastrar o sistema");
      console.error("Erro ao cadastrar sistema:", error);
      return false;
    }
  }

  async function updateSystem(id: string, input: SystemHealthInput) {
    const currentSystem = systemsRef.current.find((system) => system.id === id);
    if (!currentSystem) return false;

    const urlChanged = currentSystem.url !== input.url.trim();
    const updatedSystem: SystemHealthRecord = {
      ...currentSystem,
      name: input.name.trim(),
      url: input.url.trim(),
      // URL nova é outro sistema na prática: a contagem recomeça.
      ...(urlChanged ? { calculationStartedAt: null, lastCheckedAt: null } : {}),
    };

    try {
      const userId = await getAuthenticatedUserId();
      await patch(
        TABLE,
        {
          name: updatedSystem.name,
          url: updatedSystem.url,
          calculation_started_at: updatedSystem.calculationStartedAt,
          last_checked_at: updatedSystem.lastCheckedAt,
        },
        { id: id, user_id: userId },
        { select: "id" },
      );
      replaceSystems(
        systemsRef.current.map((system) => (system.id === id ? updatedSystem : system)),
      );
      if (urlChanged) void runChecks([updatedSystem]);
      toast.success("Sistema atualizado");
      return true;
    } catch (error) {
      showSaveError(error, "Não foi possível atualizar o sistema");
      console.error("Erro ao atualizar sistema:", error);
      return false;
    }
  }

  async function importSystems(inputs: SystemHealthInput[]) {
    const userId = await getAuthenticatedUserId();
    const uniqueInputs = [
      ...new Map(
        inputs.map((input) => [
          new URL(input.url).href,
          { ...input, url: new URL(input.url).href },
        ]),
      ).values(),
    ];
    const existingUrls = new Set(systemsRef.current.map((system) => new URL(system.url).href));
    const newInputs = uniqueInputs.filter((input) => !existingUrls.has(input.url));

    const inserted =
      newInputs.length > 0
        ? await upsertIgnoring<SystemHealthRow>(
            TABLE,
            newInputs.map((input) => ({
              user_id: userId,
              name: input.name.trim(),
              url: input.url,
            })),
            { onConflict: "user_id,url", select: SELECT_COLUMNS },
          )
        : [];
    const importedSystems = inserted.map(toRecord);

    if (importedSystems.length > 0) {
      replaceSystems([...systemsRef.current, ...importedSystems]);
      void runChecks(importedSystems);
    }

    return {
      importedCount: importedSystems.length,
      skippedCount: inputs.length - importedSystems.length,
    };
  }

  async function deleteSystem(id: string) {
    try {
      const userId = await getAuthenticatedUserId();
      await remove(TABLE, { id: id, user_id: userId });
      replaceSystems(systemsRef.current.filter((system) => system.id !== id));
      setCheckStates((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast.success("Sistema removido");
      return true;
    } catch (error) {
      toast.error("Não foi possível remover o sistema", {
        description: getApiErrorMessage(error, "Tente novamente em alguns instantes."),
      });
      console.error("Erro ao remover sistema:", error);
      return false;
    }
  }

  return {
    systems,
    checkStates,
    checkDetails,
    isLoading,
    now,
    createSystem,
    updateSystem,
    importSystems,
    deleteSystem,
  };
}
