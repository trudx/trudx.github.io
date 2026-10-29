"use client";

//* Components Imports
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";

import { ConciliacaoStatusBadge } from "./conciliacao-status-badge";
import { EntityCombobox } from "./entity-combobox";
import { formatCurrencyPrivate } from "./financeiro-privacy";

//* Libraries Imports
import { useState, type FormEvent, type ReactNode } from "react";

//* Types Imports
import type { BancoRecord } from "@/hooks/use-bancos";
import type { ClientRecord } from "@/hooks/use-clients";
import type { FinanceiroEditInput, FinanceiroRecord } from "@/hooks/use-financeiro";
import type { CategoriaRecord } from "@/hooks/use-financeiro-categorias";
import type { FinanceiroNatureza } from "@/lib/financeiro/types";

//* Constants Imports
import { NATUREZA_LABELS } from "@/lib/financeiro/natureza";

//* Utils Imports
import { formatDateLong, formatTimestamp } from "@/lib/format-date";

type FinanceiroDetailDialogProps = {
  record: FinanceiroRecord | null;
  tipoLabel: string;
  tipoClassName: string;
  clients: ClientRecord[];
  bancos: BancoRecord[];
  categorias: CategoriaRecord[];
  /** Provisório mais antigo que o saldo de referência do banco (derivado, não armazenado). */
  isObsoleto: boolean;
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
  if (record.fitid)
    return record.fitid.startsWith("pdf-") ? "Importado de PDF" : "Importado de OFX";
  return record.gasto_fixo_id ? "Gasto fixo" : "Manual";
}

function DetailBody({
  record,
  tipoLabel,
  tipoClassName,
  clients,
  bancos,
  categorias,
  isObsoleto,
  isSaving,
  isValoresHidden,
  onOpenChange,
  onSave,
  onDelete,
}: DetailBodyProps) {
  const [descricao, setDescricao] = useState(record.descricao ?? "");
  const [clienteId, setClienteId] = useState<string | null>(record.cliente_id);
  const [bancoId, setBancoId] = useState<string | null>(record.banco_id);
  const [categoriaId, setCategoriaId] = useState<string | null>(record.categoria_id);
  const [natureza, setNatureza] = useState<FinanceiroNatureza>(record.natureza);

  const isDirty =
    descricao.trim() !== (record.descricao ?? "") ||
    clienteId !== record.cliente_id ||
    bancoId !== record.banco_id ||
    categoriaId !== record.categoria_id ||
    natureza !== record.natureza;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(record.id, {
      descricao,
      cliente_id: clienteId,
      banco_id: bancoId,
      categoria_id: categoriaId,
      natureza,
    });
    if (saved) onOpenChange(false);
  }

  // Confirmar sem extrato: o usuário assume que o lançamento é definitivo (ex.: dinheiro, sem banco).
  async function handleConfirm() {
    const saved = await onSave(record.id, {
      descricao,
      cliente_id: clienteId,
      banco_id: bancoId,
      categoria_id: categoriaId,
      natureza,
      status: "confirmado",
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
        className={`my-3 text-3xl font-display font-bold ${record.tipo === "ganho" ? "text-emerald-700" : "text-foreground"}`}
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
        <DetailRow label="Categoria">
          <EntityCombobox
            value={categoriaId}
            options={categorias.map((categoria) => ({
              value: categoria.id,
              label: categoria.nome,
            }))}
            emptyLabel="Sem categoria"
            searchPlaceholder="Buscar categoria..."
            onChange={setCategoriaId}
          />
        </DetailRow>
        <DetailRow label="Natureza">
          <Select.SelectRoot
            value={natureza}
            onValueChange={(value) => setNatureza(value as FinanceiroNatureza)}
          >
            <Select.SelectTrigger className="h-10 w-full bg-background" aria-label="Natureza">
              <Select.SelectValue>{NATUREZA_LABELS[natureza]}</Select.SelectValue>
            </Select.SelectTrigger>
            <Select.SelectContent>
              {(Object.keys(NATUREZA_LABELS) as FinanceiroNatureza[]).map((option) => (
                <Select.SelectItem key={option} value={option}>
                  {NATUREZA_LABELS[option]}
                </Select.SelectItem>
              ))}
            </Select.SelectContent>
          </Select.SelectRoot>
          {natureza === "transferencia" || natureza === "pagamento_fatura" ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Fica no extrato e no saldo do banco, mas não conta como receita nem despesa.
            </span>
          ) : null}
        </DetailRow>
        <DetailRow label="Status">
          <ConciliacaoStatusBadge status={record.status} isObsoleto={isObsoleto} />
          {record.conciliado_em && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              em {formatTimestamp(record.conciliado_em)}
            </span>
          )}
        </DetailRow>
        {record.dados_originais && (
          <DetailRow label="Dados do banco">
            <span className="block">{record.dados_originais.descricao}</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {formatDateLong(record.dados_originais.data)}
            </span>
          </DetailRow>
        )}
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
        {record.status === "provisorio" && (
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => void handleConfirm()}
          >
            Confirmar sem extrato
          </Button>
        )}
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
