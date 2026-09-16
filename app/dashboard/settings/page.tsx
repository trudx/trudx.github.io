"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";

import { SettingsSkeleton, TasksZoomSetting } from "./_components";

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
    <section className="w-full max-w-3xl space-y-8">
      <div className="border-b border-foreground/15 pb-6">
        <p className="trudx-kicker mb-1.5 text-muted-foreground">Conta</p>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Configurações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualize os dados da sua conta.</p>
      </div>

      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <form className="max-w-xl space-y-5" onSubmit={handleSubmit}>
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
                className="h-11 rounded-md bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-email" className="text-[0.72rem] font-semibold">
                E-mail
              </Label>
              <Input
                id="settings-email"
                name="email"
                type="text"
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
                className="h-11 rounded-md bg-background"
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
                className="h-11 rounded-md bg-background text-sm tracking-[0.14em] placeholder:tracking-normal"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSaving} className="h-11 px-5 font-bold">
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <TasksZoomSetting />
    </section>
  );
}
