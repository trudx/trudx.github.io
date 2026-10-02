"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import { UserRound, Settings2 } from "lucide-react";
import { SettingsSection } from "./_components/settings-section";

import { ClientsListSetting, SettingsSkeleton, TaskPushNotificationsSetting, TasksZoomSetting } from "./_components";

//* Hooks Imports
import { useProfile } from "@/hooks/use-profile";

//* Types Imports
import type { FormEvent } from "react";

export default function SettingsPage() {
  const { profile, setProfile, isLoading, isSaving, updateProfile } = useProfile();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void updateProfile(profile);
  }

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <div className="border-b pb-5">
        <p className="trudx-kicker mb-1.5 text-muted-foreground">Preferências</p>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.01em] text-foreground">
          <Settings2 className="size-5" />
          Configurações
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Gerencie sua conta, a visualização e os lembretes do app.</p>
      </div>

      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <SettingsSection
          title="Dados da conta"
          description="Atualize seu nome, e-mail e senha de acesso."
          icon={UserRound}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="settings-name" className="text-[0.72rem] font-semibold">
                Nome
              </Label>
              <Input
                id="settings-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={profile.name}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-9 bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-email" className="text-[0.72rem] font-semibold">
                E-mail
              </Label>
              <Input
                id="settings-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={profile.email}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="h-9 bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-password" className="text-[0.72rem] font-semibold">
                Nova senha
              </Label>
              <Input
                id="settings-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={profile.password}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Deixe em branco para manter a atual"
                className="h-9 bg-background"
              />
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Ao alterar o e-mail ou a senha, você precisará entrar novamente.
            </p>
            <div className="flex justify-end border-t pt-4">
              <Button type="submit" disabled={isSaving} className="h-8 px-3 text-xs font-medium">
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </SettingsSection>
      )}

      <ClientsListSetting />
      <TasksZoomSetting />
      <TaskPushNotificationsSetting />
    </section>
  );
}
