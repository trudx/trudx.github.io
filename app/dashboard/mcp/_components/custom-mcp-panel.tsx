"use client";

//* Components Imports
import Button from "@/components/ui/button";
import { CustomMcpEditor } from "./custom-mcp-editor";
import { McpConfirmDialog } from "./mcp-confirm-dialog";

//* Libraries Imports
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

//* Services Imports
import { getAuthenticatedUserId } from "@/services/auth-service";
import { listCustomMcpServers, removeCustomMcpServer, saveCustomMcpServer } from "@/services/custom-mcp-service";

//* Types Imports
import type { CustomMcpServer } from "@/lib/ai/custom-mcp-config";

//* Utils Imports
import { HttpError } from "@/lib/http";

function endpointLabel(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "URL inválida";
  }
}

export function CustomMcpPanel() {
  const [account, setAccount] = useState<{ id: string; servers: CustomMcpServer[] } | null>(null);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editing, setEditing] = useState<CustomMcpServer | null | undefined>(undefined);
  const [removing, setRemoving] = useState<CustomMcpServer | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const id = await getAuthenticatedUserId();
        const servers = await listCustomMcpServers(id);
        if (active) setAccount({ id, servers });
      } catch (error) {
        if (!active) return;
        setError(
          error instanceof HttpError && error.code === "PGRST205"
            ? "A tabela de MCPs personalizados ainda precisa ser configurada no Supabase."
            : "Não foi possível carregar os servidores.",
        );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function save(input: Omit<CustomMcpServer, "id">) {
    if (!account) return;
    try {
      const saved = await saveCustomMcpServer(account.id, input, editing?.id);
      const servers = [...account.servers.filter((server) => server.id !== saved.id), saved].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
      setAccount({ ...account, servers });
      toast.success(editing ? "Servidor atualizado" : "Servidor adicionado");
    } catch (error) {
      throw new Error(
        error instanceof HttpError && error.code === "23505"
          ? "Já existe um servidor com esse nome."
          : "Não foi possível salvar o servidor.",
      );
    }
  }

  async function remove(server: CustomMcpServer) {
    if (!account) return;
    setIsRemoving(true);
    try {
      await removeCustomMcpServer(account.id, server.id);
      setAccount({ ...account, servers: account.servers.filter((item) => item.id !== server.id) });
      toast.success("Servidor removido");
    } catch {
      toast.error("Não foi possível remover o servidor.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">MCPs personalizados</h2>
          <p className="mt-1 text-muted-foreground">
            Conecte servidores MCP remotos e habilite ferramentas para o chat do Trudx.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing(null)} disabled={!account || isRemoving}>
          <Plus />
          Adicionar servidor
        </Button>
      </div>
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <p role="alert">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setLoadAttempt((n) => n + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {!error && !account && (
        <p role="status" className="text-muted-foreground">
          Carregando servidores…
        </p>
      )}
      {account?.servers.length === 0 && (
        <p className="rounded-lg border p-4 text-muted-foreground">Nenhum servidor cadastrado.</p>
      )}
      {Boolean(account?.servers.length) && (
        <ul className="divide-y rounded-lg border">
          {account?.servers.map((server) => (
            <li key={server.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="break-words font-medium">{server.name}</p>
                <p className="break-all text-xs text-muted-foreground">{endpointLabel(server.url)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {server.enabled_tools.length === 1
                    ? "1 ferramenta habilitada"
                    : `${server.enabled_tools.length} ferramentas habilitadas`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(server)} disabled={isRemoving}>
                  Editar
                </Button>
                <Button type="button" variant="destructive" onClick={() => setRemoving(server)} disabled={isRemoving}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined && (
        <CustomMcpEditor server={editing} onClose={() => setEditing(undefined)} onSave={save} />
      )}
      <McpConfirmDialog
        open={Boolean(removing)}
        title="Remover servidor MCP?"
        description={removing ? `O chat perderá acesso às ferramentas de ${removing.name}.` : ""}
        actionLabel="Remover servidor"
        onOpenChange={(open) => !open && setRemoving(null)}
        onConfirm={() => {
          if (removing) void remove(removing);
          setRemoving(null);
        }}
      />
    </section>
  );
}
