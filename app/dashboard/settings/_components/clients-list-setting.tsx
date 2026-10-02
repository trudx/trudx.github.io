"use client";

//* Components Imports
import Label from "@/components/ui/label";
import Switch from "@/components/ui/switch";

//* Hooks Imports
import { useClientListPreference } from "@/hooks/use-client-list-preference";

export function ClientsListSetting() {
  const { onlyActive, setOnlyActive } = useClientListPreference();

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex max-w-xl items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="settings-clients-only-active" className="text-[0.72rem] font-semibold">
            Listar só clientes ativos
          </Label>
          <p className="text-xs text-muted-foreground">
            Nos seletores de cliente (tarefas, agenda e financeiro). Desligado, os clientes inativos
            também aparecem. Fica salvo neste dispositivo.
          </p>
        </div>

        <Switch
          id="settings-clients-only-active"
          checked={onlyActive}
          onCheckedChange={setOnlyActive}
        />
      </div>
    </div>
  );
}
