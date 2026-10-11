"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";

//* Libraries Imports
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

//* Types Imports
import type { CategoriaRecord } from "@/hooks/use-financeiro-categorias";

type CategoriasDialogProps = {
  open: boolean;
  categorias: CategoriaRecord[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (nome: string, termos: string[]) => Promise<boolean>;
  onUpdate: (id: string, nome: string, termos: string[]) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreateSuggested: () => Promise<boolean>;
  onApplyRules: () => Promise<number>;
};

function parseTermos(text: string) {
  return text
    .split(",")
    .map((termo) => termo.trim())
    .filter(Boolean);
}

function CategoriaRow({
  categoria,
  isSaving,
  onUpdate,
  onDelete,
}: {
  categoria: CategoriaRecord;
  isSaving: boolean;
  onUpdate: CategoriasDialogProps["onUpdate"];
  onDelete: CategoriasDialogProps["onDelete"];
}) {
  const [termos, setTermos] = useState(categoria.termos.join(", "));
  const isDirty = termos !== categoria.termos.join(", ");

  return (
    <li className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
      <p className="truncate text-sm font-medium">{categoria.nome}</p>
      <Input
        value={termos}
        onChange={(event) => setTermos(event.target.value)}
        placeholder="palavras-chave, separadas por vírgula"
        aria-label={`Palavras-chave de ${categoria.nome}`}
        className="h-9 bg-background"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isDirty || isSaving}
          onClick={() => void onUpdate(categoria.id, categoria.nome, parseTermos(termos))}
        >
          Salvar
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover ${categoria.nome}`}
          onClick={() => void onDelete(categoria.id)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

export function CategoriasDialog({
  open,
  categorias,
  isSaving,
  onOpenChange,
  onCreate,
  onUpdate,
  onDelete,
  onCreateSuggested,
  onApplyRules,
}: CategoriasDialogProps) {
  const [nome, setNome] = useState("");
  const [termos, setTermos] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate(nome, parseTermos(termos))) {
      setNome("");
      setTermos("");
    }
  }

  return (
    <Dialog.DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-background p-6 sm:max-w-2xl sm:p-8">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle className="text-xl font-bold tracking-[-0.04em]">
            Categorias
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            As palavras-chave categorizam sozinhas os extratos importados e o histórico sem
            categoria. O termo mais específico vence; sem correspondência, o lançamento fica sem
            categoria.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        {categorias.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não tem categorias.</p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              disabled={isSaving}
              onClick={() => void onCreateSuggested()}
            >
              Criar categorias sugeridas
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {categorias.map((categoria) => (
                <CategoriaRow
                  key={`${categoria.id}-${categoria.termos.join()}`}
                  categoria={categoria}
                  isSaving={isSaving}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => void onApplyRules()}
            >
              Aplicar ao histórico sem categoria
            </Button>
          </>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="grid gap-3 border-t pt-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="categoria-nome">Nova categoria</Label>
            <Input
              id="categoria-nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: Saúde"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoria-termos">Palavras-chave</Label>
            <Input
              id="categoria-termos"
              value={termos}
              onChange={(event) => setTermos(event.target.value)}
              placeholder="farmacia, drogaria"
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" disabled={isSaving || !nome.trim()}>
            Adicionar
          </Button>
        </form>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
