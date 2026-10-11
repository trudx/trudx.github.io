"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";
import Switch from "@/components/ui/switch";

//* Libraries Imports
import { useState, type FormEvent } from "react";

//* Types Imports
import type { FinanceiroInput } from "@/hooks/use-financeiro";
import type { ClientRecord } from "@/hooks/use-clients";
import type { BancoRecord } from "@/hooks/use-bancos";
import type { CategoriaRecord } from "@/hooks/use-financeiro-categorias";
import type { FinanceiroNatureza } from "@/lib/financeiro/types";

//* Constants Imports
import { NATUREZA_LABELS } from "@/lib/financeiro/natureza";

type FinanceiroFormDialogProps = {
  open: boolean;
  clients: ClientRecord[];
  bancos: BancoRecord[];
  categorias: CategoriaRecord[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: FinanceiroInput) => Promise<boolean>;
};

const emptyForm: FinanceiroInput = {
  data: new Date().toISOString().slice(0, 10),
  tipo: "gasto",
  valor: 0,
  descricao: "",
  cliente_id: null,
  banco_id: null,
  status: "confirmado",
  natureza: "normal",
  categoria_id: null,
};

export function FinanceiroFormDialog({
  open,
  clients,
  bancos,
  categorias,
  isSaving,
  onOpenChange,
  onSubmit,
}: FinanceiroFormDialogProps) {
  const [form, setForm] = useState<FinanceiroInput>(emptyForm);
  // Provisório só faz sentido com banco: é o banco que permite casar com o extrato depois.
  const isProvisorio = form.status === "provisorio";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ ...form, descricao: form.descricao.trim() });
    if (saved) {
      setForm(emptyForm);
      onOpenChange(false);
    }
  }

  return (
    <Dialog.DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            Novo lançamento
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Registre um gasto ou ganho no seu extrato.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="financeiro-data">Data</Label>
              <Input
                id="financeiro-data"
                type="date"
                required
                value={form.data}
                onChange={(event) =>
                  setForm((current) => ({ ...current, data: event.target.value }))
                }
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select.SelectRoot
                value={form.tipo}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, tipo: value as FinanceiroInput["tipo"] }))
                }
              >
                <Select.SelectTrigger className="h-11 w-full bg-background">
                  <Select.SelectValue>
                    {form.tipo === "gasto" ? "Gasto" : "Ganho"}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <Select.SelectItem value="gasto">Gasto</Select.SelectItem>
                  <Select.SelectItem value="ganho">Ganho</Select.SelectItem>
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="financeiro-valor">Valor</Label>
            <Input
              id="financeiro-valor"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.valor || ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, valor: Number(event.target.value) }))
              }
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="financeiro-descricao">Descrição</Label>
            <Input
              id="financeiro-descricao"
              value={form.descricao}
              onChange={(event) =>
                setForm((current) => ({ ...current, descricao: event.target.value }))
              }
              placeholder="Ex.: Almoço com cliente"
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label>Banco (opcional)</Label>
              <Select.SelectRoot
                value={form.banco_id ?? "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    banco_id: value === "none" ? null : value,
                    // Escolher um banco sugere provisório (aguardando extrato); tirar o banco desfaz.
                    status: value === "none" ? "confirmado" : "provisorio",
                  }))
                }
              >
                <Select.SelectTrigger className="h-11 w-full bg-background">
                  <Select.SelectValue>
                    {bancos.find((banco) => banco.id === form.banco_id)?.nome ?? "Nenhum"}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <Select.SelectItem value="none">Nenhum</Select.SelectItem>
                  {bancos.map((banco) => (
                    <Select.SelectItem key={banco.id} value={banco.id}>
                      {banco.nome}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              <Select.SelectRoot
                value={form.categoria_id ?? "none"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    categoria_id: value === "none" ? null : value,
                  }))
                }
              >
                <Select.SelectTrigger className="h-11 w-full bg-background">
                  <Select.SelectValue>
                    {categorias.find((categoria) => categoria.id === form.categoria_id)?.nome ??
                      "Sem categoria"}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <Select.SelectItem value="none">Sem categoria</Select.SelectItem>
                  {categorias.map((categoria) => (
                    <Select.SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>

            <div className="space-y-2">
              <Label>Natureza</Label>
              <Select.SelectRoot
                value={form.natureza ?? "normal"}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, natureza: value as FinanceiroNatureza }))
                }
              >
                <Select.SelectTrigger className="h-11 w-full bg-background">
                  <Select.SelectValue>
                    {NATUREZA_LABELS[form.natureza ?? "normal"]}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {(Object.keys(NATUREZA_LABELS) as FinanceiroNatureza[]).map((natureza) => (
                    <Select.SelectItem key={natureza} value={natureza}>
                      {NATUREZA_LABELS[natureza]}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          </div>

          {form.banco_id && (
            <label className="flex items-start gap-3 rounded-lg border bg-card p-3">
              <Switch
                checked={isProvisorio}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    status: checked ? "provisorio" : "confirmado",
                  }))
                }
                aria-label="Lançamento provisório"
              />
              <span className="text-sm">
                Provisório (aguardando o extrato)
                <span className="block text-xs text-muted-foreground">
                  Quando você importar o extrato do banco, ele é conciliado com este lançamento em
                  vez de duplicar o valor.
                </span>
              </span>
            </label>
          )}

          <Dialog.DialogFooter className="mt-6 border-t-0 bg-transparent p-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Cadastrar lançamento"}
            </Button>
          </Dialog.DialogFooter>
        </form>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
