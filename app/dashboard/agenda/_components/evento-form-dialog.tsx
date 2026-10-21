"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Checkbox from "@/components/ui/checkbox";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/textarea";

//* Libraries Imports
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

//* Types Imports
import type { ClientRecord } from "@/hooks/use-clients";
import type { EventoInput, EventoRecord } from "@/hooks/use-eventos";
import type { TaskColumnRecord } from "@/hooks/use-task-columns";

type EventoFormDialogProps = {
  open: boolean;
  evento: EventoRecord | null;
  clients: ClientRecord[];
  columns: TaskColumnRecord[];
  isLoadingColumns: boolean;
  onRefreshColumns: () => Promise<void>;
  isSaving: boolean;
  initialRange?: { start: Date; end: Date } | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: EventoInput, columnId: string, creationId: string) => Promise<boolean>;
  onDelete?: () => void;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDatetimeInput(date: Date) {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type FormState = {
  titulo: string;
  descricao: string;
  local: string;
  dia_inteiro: boolean;
  inicio: string;
  fim: string;
  cliente_id: string | null;
};

function buildInitialForm(
  evento: EventoRecord | null,
  initialRange?: { start: Date; end: Date } | null,
): FormState {
  if (evento) {
    const inicioDate = new Date(evento.data_inicio);
    const fimDate = new Date(evento.data_fim);
    return {
      titulo: evento.titulo,
      descricao: evento.descricao ?? "",
      local: evento.local ?? "",
      dia_inteiro: evento.dia_inteiro,
      inicio: evento.dia_inteiro ? toDateInput(inicioDate) : toDatetimeInput(inicioDate),
      fim: evento.dia_inteiro ? toDateInput(fimDate) : toDatetimeInput(fimDate),
      cliente_id: evento.cliente_id,
    };
  }

  const start = initialRange?.start ?? new Date();
  const end = initialRange?.end ?? new Date(start.getTime() + 60 * 60 * 1000);
  return {
    titulo: "",
    descricao: "",
    local: "",
    dia_inteiro: false,
    inicio: toDatetimeInput(start),
    fim: toDatetimeInput(end),
    cliente_id: null,
  };
}

export function EventoFormDialog({
  open,
  evento,
  clients,
  columns,
  isLoadingColumns,
  onRefreshColumns,
  isSaving,
  initialRange,
  onOpenChange,
  onSubmit,
  onDelete,
}: EventoFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(evento, initialRange));
  const [columnId, setColumnId] = useState<string | null>(null);
  const [creationId] = useState(() => crypto.randomUUID());
  const isEditing = Boolean(evento);
  const hasSelectedColumn = columns.some((column) => column.id === columnId);

  function handleDiaInteiroChange(checked: boolean) {
    setForm((current) => ({
      ...current,
      dia_inteiro: checked,
      inicio: checked ? current.inicio.slice(0, 10) : toDatetimeInput(new Date(current.inicio)),
      fim: checked ? current.fim.slice(0, 10) : toDatetimeInput(new Date(current.fim)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    if (!isEditing && !hasSelectedColumn) {
      toast.error("Escolha em qual coluna criar a tarefa");
      return;
    }

    const inicio = form.dia_inteiro ? new Date(`${form.inicio}T00:00:00`) : new Date(form.inicio);
    const fim = form.dia_inteiro ? new Date(`${form.fim}T23:59:59`) : new Date(form.fim);

    if (fim < inicio) {
      toast.error("O fim do evento não pode ser antes do início");
      return;
    }

    const saved = await onSubmit(
      {
        titulo: form.titulo.trim(),
        descricao: form.descricao,
        local: form.local,
        dia_inteiro: form.dia_inteiro,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString(),
        cliente_id: form.cliente_id,
      },
      columnId ?? "",
      creationId,
    );
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog.DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
      }}
    >
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            {isEditing ? "Editar evento" : "Novo evento"}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            {isEditing
              ? "Atualize os detalhes do evento."
              : "Agende um compromisso e crie uma tarefa automaticamente na coluna escolhida."}
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <fieldset disabled={isSaving} className="min-w-0 space-y-4">
            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="evento-task-column">Em qual coluna criar a tarefa?</Label>
                <Select.SelectRoot
                  value={columnId}
                  onValueChange={setColumnId}
                  disabled={isLoadingColumns || columns.length === 0}
                >
                  <Select.SelectTrigger
                    id="evento-task-column"
                    className="h-11 w-full bg-background"
                  >
                    <Select.SelectValue>
                      {columns.find((column) => column.id === columnId)?.name ??
                        (isLoadingColumns ? "Carregando colunas..." : "Escolha uma coluna")}
                    </Select.SelectValue>
                  </Select.SelectTrigger>
                  <Select.SelectContent>
                    {columns.map((column) => (
                      <Select.SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </Select.SelectItem>
                    ))}
                  </Select.SelectContent>
                </Select.SelectRoot>
                {!isLoadingColumns && columns.length === 0 && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Nenhuma coluna disponível. Crie uma coluna em Tarefas ou tente carregar
                      novamente.
                    </p>
                    <Button type="button" variant="outline" onClick={() => void onRefreshColumns()}>
                      Recarregar colunas
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="evento-titulo">Título</Label>
              <Input
                id="evento-titulo"
                required
                value={form.titulo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, titulo: event.target.value }))
                }
                placeholder="Ex.: Reunião com cliente"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evento-descricao">Descrição</Label>
              <Textarea
                id="evento-descricao"
                value={form.descricao}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descricao: event.target.value }))
                }
                placeholder="Detalhes importantes para esse evento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evento-local">Local</Label>
              <Input
                id="evento-local"
                value={form.local}
                onChange={(event) =>
                  setForm((current) => ({ ...current, local: event.target.value }))
                }
                placeholder="Ex.: Escritório do cliente, chamada de vídeo..."
                className="h-11"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="evento-dia-inteiro"
                checked={form.dia_inteiro}
                onCheckedChange={(checked) => handleDiaInteiroChange(checked === true)}
              />
              <Label
                htmlFor="evento-dia-inteiro"
                className="text-sm font-medium text-muted-foreground"
              >
                Dia inteiro
              </Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="evento-inicio">Início</Label>
                <Input
                  id="evento-inicio"
                  type={form.dia_inteiro ? "date" : "datetime-local"}
                  required
                  value={form.inicio}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, inicio: event.target.value }))
                  }
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evento-fim">Fim</Label>
                <Input
                  id="evento-fim"
                  type={form.dia_inteiro ? "date" : "datetime-local"}
                  required
                  value={form.fim}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, fim: event.target.value }))
                  }
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select.SelectRoot
                value={form.cliente_id ?? "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    cliente_id: value === "none" ? null : value,
                  }))
                }
              >
                <Select.SelectTrigger className="h-11 w-full bg-background">
                  <Select.SelectValue>
                    {clients.find((client) => client.id === form.cliente_id)?.name ?? "Nenhum"}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <Select.SelectItem value="none">Nenhum</Select.SelectItem>
                  {clients.map((client) => (
                    <Select.SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>

            <Dialog.DialogFooter className="mt-6 flex-row items-center justify-between border-t-0 bg-transparent p-0 sm:justify-between">
              {isEditing && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={isSaving}
                  onClick={onDelete}
                >
                  Excluir
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || (!isEditing && (isLoadingColumns || !hasSelectedColumn))}
                >
                  {isSaving
                    ? "Salvando..."
                    : isEditing
                      ? "Salvar alterações"
                      : "Criar evento e tarefa"}
                </Button>
              </div>
            </Dialog.DialogFooter>
          </fieldset>
        </form>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
