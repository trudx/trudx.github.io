"use client";

//* Components Imports
import Label from "@/components/ui/label";
import Switch from "@/components/ui/switch";
import { UsersRound } from "lucide-react";
import { SettingsSection } from "./settings-section";

//* Hooks Imports
import { useClientListPreference } from "@/hooks/use-client-list-preference";

export function ClientsListSetting() {
  const { onlyActive, setOnlyActive } = useClientListPreference();

  return (
    <SettingsSection
      title="Clientes"
      description="Escolha quais clientes aparecem nos seletores do app."
      icon={UsersRound}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="settings-clients-only-active" className="text-[0.72rem] font-semibold">
            Listar só clientes ativos
          </Label>
          <p className="text-xs text-muted-foreground">
            Nos seletores de cliente (tarefas, agenda e financeiro). Desligado, os clientes inativos também aparecem.
            Fica salvo neste dispositivo.
          </p>
        </div>

        <Switch id="settings-clients-only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
      </div>
    </SettingsSection>
  );
}
