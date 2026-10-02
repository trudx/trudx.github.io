"use client";

//* Components Imports
import Alert from "@/components/ui/alert";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Table from "@/components/ui/table";

import { SystemHealthDeleteDialog, SystemHealthFormDialog } from "./_components";

//* Libraries Imports
import {
  Activity,
  CircleCheck,
  CircleX,
  Download,
  ExternalLink,
  HardDrive,
  HeartPulse,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

//* Hooks Imports
import { useSystemHealth } from "@/hooks/use-system-health";

//* Types Imports
import type { SystemHealthCheckState, SystemHealthInput, SystemHealthRecord } from "@/lib/system-health";

//* Utils Imports
import {
  createSystemHealthConfig,
  formatSystemHealthDate,
  getSystemHealthDays,
  parseSystemHealthConfig,
} from "@/lib/system-health";
import { cn } from "@/lib/utils";

const statusPresentation: Record<
  SystemHealthCheckState,
  { label: string; className: string; icon: typeof CircleCheck }
> = {
  checking: {
    label: "Verificando",
    className: "border-foreground/15 text-muted-foreground",
    icon: LoaderCircle,
  },
  online: {
    label: "Online",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: CircleCheck,
  },
  unverified: {
    label: "Não verificado",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: ShieldCheck,
  },
  offline: {
    label: "Offline",
    className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    icon: CircleX,
  },
};

export default function SystemHealthPage() {
  const {
    systems,
    checkStates,
    checkDetails,
    isLoading,
    now,
    createSystem,
    updateSystem,
    importSystems,
    deleteSystem,
  } = useSystemHealth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemHealthRecord | null>(null);
  const [deletingSystem, setDeletingSystem] = useState<SystemHealthRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<SystemHealthCheckState | "all">("all");
  const importInputRef = useRef<HTMLInputElement>(null);

  const onlineCount = systems.filter((system) => checkStates[system.id] === "online").length;
  const offlineCount = systems.filter((system) => checkStates[system.id] === "offline").length;
  const unverifiedCount = systems.filter((system) => checkStates[system.id] === "unverified").length;
  const checkingCount = systems.filter((system) => (checkStates[system.id] ?? "checking") === "checking").length;
  const visibleSystems = systems.filter(
    (system) => statusFilter === "all" || (checkStates[system.id] ?? "checking") === statusFilter,
  );

  function handleOpenCreate() {
    setEditingSystem(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(system: SystemHealthRecord) {
    setEditingSystem(system);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: SystemHealthInput) {
    return editingSystem ? updateSystem(editingSystem.id, input) : createSystem(input);
  }

  function handleExportConfig() {
    const blob = new Blob([createSystemHealthConfig(systems)], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    downloadLink.download = `trudx-saude-sistemas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    toast.success("Configurações baixadas em JSON", {
      description: "O arquivo contém os nomes e as URLs cadastradas.",
    });
  }

  async function handleImportConfig(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      input.value = "";
      return;
    }

    try {
      if (file.size > 1_000_000) {
        throw new Error("O arquivo deve ter menos de 1 MB.");
      }

      const parsedConfig = parseSystemHealthConfig(JSON.parse(await file.text()));
      const { importedCount, skippedCount } = importSystems(parsedConfig);

      if (importedCount === 0 && skippedCount === 0) {
        toast.info("O arquivo não contém sistemas para importar.");
      } else if (importedCount === 0) {
        toast.info("Nenhum sistema novo foi importado", {
          description: "Todas as URLs do arquivo já estão cadastradas.",
        });
      } else {
        toast.success(`${importedCount} ${importedCount === 1 ? "sistema importado" : "sistemas importados"}`, {
          description:
            skippedCount > 0
              ? `${skippedCount} URL(s) repetida(s) foram ignoradas. As novas URLs serão verificadas agora.`
              : "As novas URLs serão verificadas agora e iniciarão uma nova contagem.",
        });
      }
    } catch (error) {
      toast.error("Não foi possível importar esse JSON", {
        description: error instanceof Error ? error.message : "Selecione uma exportação válida do trudx.",
      });
    } finally {
      input.value = "";
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="trudx-kicker mb-1.5 text-muted-foreground">Monitoramento</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-foreground">
            <HeartPulse className="size-5" />
            Saúde de sistemas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Acompanhe por quantos dias cada sistema segue respondendo à verificação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || checkingCount > 0 || systems.length === 0}
            className="h-8 px-3 text-xs font-medium"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className={cn(checkingCount > 0 && "animate-spin")} />
            {checkingCount > 0 ? "Verificando..." : "Verificar agora"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || systems.length === 0}
            className="h-8 px-3 text-xs font-medium"
            onClick={handleExportConfig}
          >
            <Download />
            Baixar JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            className="h-8 px-3 text-xs font-medium"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload />
            Importar JSON
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            className="h-8 px-3 text-xs font-medium"
            onClick={handleOpenCreate}
          >
            <Plus />
            Cadastrar sistema
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportConfig}
            aria-label="Importar arquivo JSON de sistemas"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">
        <Card.CardRoot size="sm">
          <Card.CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Sistemas cadastrados</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{systems.length}</p>
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </Card.CardContent>
        </Card.CardRoot>
        <Card.CardRoot size="sm" className="bg-emerald-500/5 ring-emerald-500/25">
          <Card.CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Online · HTTP 200</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {onlineCount}
              </p>
            </div>
            <CircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          </Card.CardContent>
        </Card.CardRoot>
        <Card.CardRoot size="sm" className="bg-red-500/5 ring-red-500/25">
          <Card.CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Offline</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">{offlineCount}</p>
            </div>
            <CircleX className="size-5 text-red-600 dark:text-red-400" />
          </Card.CardContent>
        </Card.CardRoot>
        <Card.CardRoot size="sm" className="bg-amber-500/5 ring-amber-500/25">
          <Card.CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Não verificados</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {unverifiedCount}
              </p>
            </div>
            <ShieldCheck className="size-5 text-amber-600 dark:text-amber-400" />
          </Card.CardContent>
        </Card.CardRoot>
      </div>

      <Card.CardRoot className="gap-0 py-0">
        <Card.CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <div>
            <Card.CardTitle>Sistemas monitorados</Card.CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Carregando..." : `${systems.length} ${systems.length === 1 ? "sistema" : "sistemas"}`}
          </span>
        </Card.CardHeader>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" aria-label="Filtrar sistemas por estado">
          {(
            [
              ["all", "Todos", systems.length],
              ["online", "Online", onlineCount],
              ["offline", "Offline", offlineCount],
              ["unverified", "Não verificados", unverifiedCount],
              ["checking", "Verificando", checkingCount],
            ] as const
          ).map(([value, label, count]) => (
            <Button
              key={value}
              type="button"
              variant={statusFilter === value ? "secondary" : "ghost"}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "h-8 gap-2 px-3 text-xs",
                value !== "all" && statusPresentation[value].className,
                statusFilter === value && "ring-1 ring-current",
              )}
            >
              {value !== "all" && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
              {label}
              <span className="tabular-nums opacity-75">{count}</span>
            </Button>
          ))}
        </div>

        <Table.TableRoot>
          <Table.TableHeader>
            <Table.TableRow>
              <Table.TableHead>Sistema</Table.TableHead>
              <Table.TableHead>URL de verificação</Table.TableHead>
              <Table.TableHead>Estado</Table.TableHead>
              <Table.TableHead>Dias online</Table.TableHead>
              <Table.TableHead>Início da contagem</Table.TableHead>
              <Table.TableHead>Última checagem</Table.TableHead>
              <Table.TableHead className="text-right">Ações</Table.TableHead>
            </Table.TableRow>
          </Table.TableHeader>
          <Table.TableBody>
            {visibleSystems.map((system) => {
              const state = checkStates[system.id] ?? "checking";
              const presentation = statusPresentation[state];
              const StatusIcon = presentation.icon;
              const daysOnline = getSystemHealthDays(system.calculationStartedAt, now);

              return (
                <Table.TableRow
                  key={system.id}
                  className={cn(
                    state === "online" && "bg-emerald-500/[0.03]",
                    state === "offline" && "bg-red-500/[0.05]",
                  )}
                >
                  <Table.TableCell>
                    <div>
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            state === "online"
                              ? "bg-emerald-500"
                              : state === "offline"
                                ? "bg-red-500"
                                : state === "unverified"
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground animate-pulse",
                          )}
                        />
                        {system.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Cadastrado {formatSystemHealthDate(system.createdAt)}
                      </p>
                    </div>
                  </Table.TableCell>
                  <Table.TableCell className="max-w-72">
                    <a
                      href={system.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span className="truncate">{system.url}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </Table.TableCell>
                  <Table.TableCell>
                    <Badge variant="outline" className={cn("gap-1.5", presentation.className)}>
                      <StatusIcon className={cn("size-3", state === "checking" && "animate-spin")} />
                      {presentation.label}
                    </Badge>
                    {checkDetails[system.id] && state !== "checking" && (
                      <p className="mt-1 max-w-72 whitespace-normal break-words text-xs text-muted-foreground">
                        {checkDetails[system.id]}
                      </p>
                    )}
                  </Table.TableCell>
                  <Table.TableCell>
                    <span className="font-semibold tabular-nums">{daysOnline}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{daysOnline === 1 ? "dia" : "dias"}</span>
                  </Table.TableCell>
                  <Table.TableCell className="text-xs text-muted-foreground">
                    {formatSystemHealthDate(system.calculationStartedAt)}
                  </Table.TableCell>
                  <Table.TableCell className="text-xs text-muted-foreground">
                    {formatSystemHealthDate(system.lastCheckedAt)}
                  </Table.TableCell>
                  <Table.TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${system.name}`}
                        onClick={() => handleOpenEdit(system)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remover ${system.name}`}
                        onClick={() => setDeletingSystem(system)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </Table.TableCell>
                </Table.TableRow>
              );
            })}
            {!isLoading && systems.length > 0 && visibleSystems.length === 0 && (
              <Table.TableRow>
                <Table.TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Nenhum sistema neste estado.
                </Table.TableCell>
              </Table.TableRow>
            )}
            {!isLoading && systems.length === 0 && (
              <Table.TableRow>
                <Table.TableCell colSpan={7} className="h-36 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <HeartPulse className="size-5 text-muted-foreground" />
                    <p className="font-medium">Nenhum sistema cadastrado</p>
                    <p className="text-xs text-muted-foreground">
                      Adicione uma URL pública para começar a acompanhar a disponibilidade.
                    </p>
                  </div>
                </Table.TableCell>
              </Table.TableRow>
            )}
          </Table.TableBody>
        </Table.TableRoot>
      </Card.CardRoot>

      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Sobre as verificações e o backup dos sistemas</summary>
        <div className="mt-4 space-y-3">
          <Alert.AlertRoot className="items-start gap-3 border-foreground/15 bg-muted/40 p-4">
            <HardDrive className="mt-0.5 size-4" />
            <div>
              <Alert.AlertTitle className="font-semibold">Configurações salvas localmente</Alert.AlertTitle>
              <Alert.AlertDescription>
                Os sistemas ficam neste navegador e não são sincronizados com outros dispositivos. Baixe o JSON para
                guardar uma cópia dos nomes e URLs. Importar adiciona URLs novas, ignora as repetidas e inicia uma nova
                contagem após a próxima resposta 200.
              </Alert.AlertDescription>
            </div>
          </Alert.AlertRoot>

          <Alert.AlertRoot className="items-start gap-3 border-foreground/15 bg-muted/40 p-4">
            <ShieldCheck className="mt-0.5 size-4" />
            <div className="space-y-2">
              <Alert.AlertTitle className="font-semibold">Como funciona o monitoramento</Alert.AlertTitle>
              <Alert.AlertDescription className="space-y-1.5 text-sm">
                <p>
                  Cadastre a URL de uma rota <strong className="text-foreground">pública, sem autenticação</strong>, que
                  responda com o status HTTP <strong className="text-foreground">200</strong>.
                </p>
                <p>
                  A verificação é feita pelo navegador ao abrir esta aba. A rota também precisa permitir CORS para o
                  domínio do trudx e usar HTTPS quando o app estiver em HTTPS. Bloqueios do navegador aparecem como “Não
                  verificado”; respostas HTTP diferentes de 200 aparecem como “Offline”.
                </p>
                <p className="flex items-start gap-2 font-medium text-foreground">
                  <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
                  Para verificar novamente, recarregue esta página. Se um sistema falhar, a contagem e a última checagem
                  válida são apagadas; quando voltar a responder 200, uma nova contagem começa.
                </p>
              </Alert.AlertDescription>
            </div>
          </Alert.AlertRoot>
        </div>
      </details>

      <SystemHealthFormDialog
        key={`${editingSystem?.id ?? "new"}-${isFormOpen}`}
        open={isFormOpen}
        system={editingSystem}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
      />
      <SystemHealthDeleteDialog
        open={Boolean(deletingSystem)}
        systemName={deletingSystem?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setDeletingSystem(null);
        }}
        onConfirm={() => {
          if (deletingSystem) deleteSystem(deletingSystem.id);
          setDeletingSystem(null);
        }}
      />
    </section>
  );
}
