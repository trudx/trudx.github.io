"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";

//* Libraries Imports
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

//* Hooks Imports
import { useFinanceiroPrivacy } from "./financeiro-privacy";

//* Types Imports
import type { BancoRecord } from "@/hooks/use-bancos";
import type { SaldoReferenciaRecord } from "@/hooks/use-financeiro-saldos";
import type { ConsolidatedBalance, BankBalance } from "@/lib/financeiro/balance";

//* Utils Imports
import { formatDate } from "@/lib/format-date";

type FinanceiroSaldoDialogProps = {
  balance: ConsolidatedBalance;
  bankBalances: BankBalance[];
  bancos: BancoRecord[];
  referencias: SaldoReferenciaRecord[];
  onOpenChange: (open: boolean) => void;
  onSaveReferencia: (bancoId: string, data: string, saldo: number) => Promise<boolean>;
  onDeleteReferencia: (id: string) => Promise<boolean>;
};

const ORIGEM_LABEL = { pdf: "PDF", ofx: "OFX", manual: "Manual" } as const;

export function FinanceiroSaldoDialog({
  balance,
  bankBalances,
  bancos,
  referencias,
  onOpenChange,
  onSaveReferencia,
  onDeleteReferencia,
}: FinanceiroSaldoDialogProps) {
  const { formatValor } = useFinanceiroPrivacy();
  const [bancoId, setBancoId] = useState<string>("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saldo, setSaldo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const nome = (id: string | null) => bancos.find((banco) => banco.id === id)?.nome ?? "Sem banco";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(saldo.replace(",", "."));
    if (!bancoId || !Number.isFinite(value)) return;

    setIsSaving(true);
    const saved = await onSaveReferencia(bancoId, data, value);
    setIsSaving(false);
    if (saved) setSaldo("");
  }

  return (
    <Dialog.DialogRoot open onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-xl sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            Saldos por banco
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            O saldo <strong>confirmado</strong> parte de um saldo de extrato validado e soma só
            movimentos oficiais depois dele. O <strong>estimado</strong> inclui também os seus
            lançamentos provisórios.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Banco</th>
                <th className="pb-2 text-right font-medium">Confirmado</th>
                <th className="pb-2 text-right font-medium">Estimado</th>
              </tr>
            </thead>
            <tbody>
              {bankBalances.map((bank) => (
                <tr key={bank.bancoId ?? "none"} className="border-t">
                  <th scope="row" className="py-2 text-left font-medium">
                    {nome(bank.bancoId)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {bank.kind === "bancario" && bank.refData
                        ? `Referência em ${formatDate(bank.refData)}`
                        : "Sem saldo de referência — valor calculado do histórico"}
                    </span>
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {bank.confirmado === null ? "—" : formatValor(bank.confirmado / 100)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatValor(bank.estimado / 100)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <th scope="row" className="py-2 text-left">
                  Total
                </th>
                <td className="py-2 text-right tabular-nums">
                  {balance.confirmado === null ? "—" : formatValor(balance.confirmado / 100)}
                  {balance.confirmado !== null && !balance.isCompleto && (
                    <span className="block text-xs font-normal text-muted-foreground">parcial</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatValor(balance.estimado / 100)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold">Informar saldo conferido</p>
          <p className="text-xs text-muted-foreground">
            Use o saldo que o app do banco mostra numa data. Ele vira a âncora do saldo confirmado.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Select.SelectRoot
                value={bancoId}
                onValueChange={(value) => setBancoId(String(value))}
              >
                <Select.SelectTrigger className="h-10 w-full bg-background">
                  <Select.SelectValue>{bancoId ? nome(bancoId) : "Escolha"}</Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {bancos.map((banco) => (
                    <Select.SelectItem key={banco.id} value={banco.id}>
                      {banco.nome}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saldo-ref-data">Data</Label>
              <Input
                id="saldo-ref-data"
                type="date"
                required
                value={data}
                onChange={(event) => setData(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saldo-ref-valor">Saldo (R$)</Label>
              <Input
                id="saldo-ref-valor"
                inputMode="decimal"
                required
                value={saldo}
                onChange={(event) => setSaldo(event.target.value)}
                placeholder="0,00"
                className="h-10"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isSaving || !bancoId || !saldo}>
            {isSaving ? "Salvando..." : "Salvar saldo de referência"}
          </Button>
        </form>

        {referencias.length > 0 && (
          <ul className="space-y-1 border-t pt-4 text-sm">
            {referencias.slice(0, 8).map((referencia) => (
              <li key={referencia.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {nome(referencia.banco_id)} · {formatDate(referencia.data)} ·{" "}
                  {formatValor(Number(referencia.saldo))}
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    ({ORIGEM_LABEL[referencia.origem]})
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover saldo de referência de ${formatDate(referencia.data)}`}
                  onClick={() => void onDeleteReferencia(referencia.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
