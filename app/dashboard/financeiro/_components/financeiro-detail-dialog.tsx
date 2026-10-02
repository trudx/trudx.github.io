"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";

import { EntityCombobox } from "./entity-combobox";
import { formatCurrencyPrivate } from "./financeiro-privacy";

//* Libraries Imports
import { useState, type FormEvent, type ReactNode } from "react";

//* Types Imports
import type { BancoRecord } from "@/hooks/use-bancos";
import type { ClientRecord } from "@/hooks/use-clients";
import type { FinanceiroEditInput, FinanceiroRecord } from "@/hooks/use-financeiro";

//* Utils Imports
import { formatDateLong, formatTimestamp } from "@/lib/format-date";

type FinanceiroDetailDialogProps = {
  record: FinanceiroRecord | null;
  tipoLabel: string;
  tipoClassName: string;
  clients: ClientRecord[];
  bancos: BancoRecord[];
  isSaving: boolean;
  isValoresHidden: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, input: FinanceiroEditInput) => Promise<boolean>;
  onDelete: (record: FinanceiroRecord) => void;
};

type DetailBodyProps = Omit<FinanceiroDetailDialogProps, "record"> & { record: FinanceiroRecord };

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function getOrigemLabel(record: FinanceiroRecord) {
  if (record.fitid) return record.fitid.startsWith("pdf-") ? "Importado de PDF" : "Importado de OFX";
  return record.gasto_fixo_id ? "Gasto fixo" : "Manual";
}

function DetailBody({
  record,
  tipoLabel,
  tipoClassName,
  clients,
  bancos,
  isSaving,
  isValoresHidden,
  onOpenChange,
  onSave,
  onDelete,
}: DetailBodyProps) {
  const [descricao, setDescricao] = useState(record.descricao ?? "");
  const [clienteId, setClienteId] = useState<string | null>(record.cliente_id);
  const [bancoId, setBancoId] = useState<string | null>(record.banco_id);

  const isDirty =
    descricao.trim() !== (record.descricao ?? "") ||
    clienteId !== record.cliente_id ||
    bancoId !== record.banco_id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(record.id, {
      descricao,
      cliente_id: clienteId,
      banco_id: bancoId,
    });
    if (saved) onOpenChange(false);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Dialog.DialogHeader>
        <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
          Detalhes do lançamento
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>{formatDateLong(record.data)}</Dialog.DialogDescription>
      </Dialog.DialogHeader>

      <p
        className={`my-3 text-3xl font-black tracking-[-0.06em] ${record.tipo === "ganho" ? "text-emerald-700" : "text-foreground"}`}
      >
        {record.tipo === "ganho" ? "+" : "-"}
        {formatCurrencyPrivate(record.valor, isValoresHidden)}
      </p>

      <dl>
        <DetailRow label="Descrição">
          <Input
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Sem descrição"
            aria-label="Descrição"
            className="h-10 bg-background"
          />
        </DetailRow>
        <DetailRow label="Cliente">
          <EntityCombobox
            value={clienteId}
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            emptyLabel="Sem cliente"
            searchPlaceholder="Buscar cliente..."
            onChange={setClienteId}
          />
        </DetailRow>
        <DetailRow label="Banco">
          <EntityCombobox
            value={bancoId}
            options={bancos.map((banco) => ({ value: banco.id, label: banco.nome }))}
            emptyLabel="Sem banco"
            searchPlaceholder="Buscar banco..."
            onChange={setBancoId}
          />
        </DetailRow>
        <DetailRow label="Tipo">
          <Badge variant="outline" className={tipoClassName}>
            {tipoLabel}
          </Badge>
        </DetailRow>
        <DetailRow label="Origem">{getOrigemLabel(record)}</DetailRow>
        {record.fitid && (
          <DetailRow label="ID da transação">
            <span className="font-mono text-xs">{record.fitid}</span>
          </DetailRow>
        )}
        <DetailRow label="Cadastrado em">{formatTimestamp(record.created_at)}</DetailRow>
      </dl>

      <Dialog.DialogFooter className="mt-4 border-t-0 bg-transparent p-0">
        <Button type="button" variant="destructive" onClick={() => onDelete(record)}>
          Excluir
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
        <Button type="submit" disabled={!isDirty || isSaving}>
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </Dialog.DialogFooter>
    </form>
  );
}

export function FinanceiroDetailDialog({ record, ...props }: FinanceiroDetailDialogProps) {
  return (
    <Dialog.DialogRoot open={Boolean(record)} onOpenChange={props.onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        {record && <DetailBody key={record.id} record={record} {...props} />}
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
