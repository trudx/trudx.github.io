"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";

//* Libraries Imports
import { useState, type FormEvent } from "react";

//* Types Imports
import type { SystemHealthInput, SystemHealthRecord } from "@/lib/system-health";

type SystemHealthFormDialogProps = {
  open: boolean;
  system: SystemHealthRecord | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: SystemHealthInput) => Promise<boolean>;
};

export function SystemHealthFormDialog({
  open,
  system,
  onOpenChange,
  onSubmit,
}: SystemHealthFormDialogProps) {
  const [name, setName] = useState(system?.name ?? "");
  const [url, setUrl] = useState(system?.url ?? "");
  const [urlError, setUrlError] = useState("");
  const isEditing = Boolean(system);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      setUrlError("Informe uma URL válida, começando com https:// ou http://.");
      return;
    }

    if (
      (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      setUrlError("Use uma URL HTTP ou HTTPS pública, sem usuário ou senha na URL.");
      return;
    }
    setUrlError("");

    const saved = await onSubmit({
      name: name.trim(),
      url: parsedUrl.toString(),
    });
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog.DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-lg sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            {isEditing ? "Editar sistema" : "Cadastrar sistema"}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Informe o nome e a URL pública usada para verificar a disponibilidade.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="system-health-name">Nome do sistema</Label>
            <Input
              id="system-health-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: API principal"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-health-url">URL da rota de saúde</Label>
            <Input
              id="system-health-url"
              type="url"
              required
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setUrlError("");
              }}
              placeholder="https://api.exemplo.com/health"
              className="h-11"
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            <p className="text-xs text-muted-foreground">
              Use uma rota GET pública, sem autenticação, que responda diretamente com HTTP 200 e
              não dependa de tokens na URL.
            </p>
          </div>

          <Dialog.DialogFooter className="mt-6 border-t-0 bg-transparent p-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !url.trim()}>
              {isEditing ? "Salvar alterações" : "Cadastrar sistema"}
            </Button>
          </Dialog.DialogFooter>
        </form>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
