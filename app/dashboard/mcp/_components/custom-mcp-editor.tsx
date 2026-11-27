"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Textarea from "@/components/ui/textarea";

//* Libraries Imports
import { useEffect, useRef, useState, type FormEvent } from "react";

//* Types Imports
import type { CustomMcpServer } from "@/lib/ai/custom-mcp-config";
import type { McpTool } from "@/lib/ai/types";

//* Utils Imports
import { importClaudeMcp, parseMcpJson, validateMcpConfig } from "@/lib/ai/custom-mcp-config";
import { testCustomMcp } from "@/lib/ai/custom-mcp-client";

type CustomMcpEditorProps = {
  server: CustomMcpServer | null;
  onClose: () => void;
  onSave: (input: Omit<CustomMcpServer, "id">) => Promise<void>;
};

function connectionKey(url: string, headers: Record<string, string>) {
  return JSON.stringify([url, Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))]);
}

export function CustomMcpEditor({ server, onClose, onSave }: CustomMcpEditorProps) {
  const [name, setName] = useState(server?.name ?? "");
  const [url, setUrl] = useState(server?.url ?? "");
  const [headers, setHeaders] = useState(JSON.stringify(server?.headers ?? {}, null, 2));
  const [importText, setImportText] = useState("");
  const [imported, setImported] = useState<ReturnType<typeof importClaudeMcp>>([]);
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [selected, setSelected] = useState(server?.enabled_tools ?? []);
  const [checkedConnection, setCheckedConnection] = useState(server ? connectionKey(server.url, server.headers) : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"testing" | "saving" | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function config() {
    return validateMcpConfig(name, url, parseMcpJson(headers.trim() || "{}"));
  }

  function loadImported(item: ReturnType<typeof importClaudeMcp>[number]) {
    setName(item.name);
    setUrl(item.url);
    setHeaders(JSON.stringify(item.headers, null, 2));
    setImportText("");
    setImported([]);
    setTools(null);
    setError("");
  }

  function importConfig() {
    try {
      const servers = importClaudeMcp(importText);
      if (servers.length === 1) loadImported(servers[0]);
      else setImported(servers);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível importar o JSON.");
    }
  }

  async function testConnection() {
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setBusy("testing");
    try {
      const input = config();
      const tested = await testCustomMcp(input, abort.signal);
      const key = connectionKey(input.url, input.headers);
      const available = new Set(tested.map((tool) => tool.name));
      setSelected((current) => (checkedConnection === key ? current.filter((name) => available.has(name)) : []));
      setCheckedConnection(key);
      setTools(tested);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(error instanceof Error ? error.message : "Não foi possível testar a conexão.");
    } finally {
      if (!abort.signal.aborted) setBusy(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy("saving");
    try {
      const input = config();
      const enabled_tools = checkedConnection === connectionKey(input.url, input.headers) ? selected : [];
      await onSave({ ...input, enabled_tools });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível salvar o servidor.");
      setBusy(null);
    }
  }

  return (
    <Dialog.DialogRoot open onOpenChange={(open) => !open && busy !== "saving" && onClose()}>
      <Dialog.DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>{server ? "Editar servidor MCP" : "Adicionar servidor MCP"}</Dialog.DialogTitle>
          <Dialog.DialogDescription>
            Cadastre um servidor HTTPS e teste a conexão para escolher as ferramentas do chat.
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>

        <form onSubmit={(event) => void save(event)} className="grid gap-4">
          <fieldset disabled={Boolean(busy)} className="grid min-w-0 gap-4">
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Importar .mcp.json do Claude Code</summary>
              <div className="mt-3 grid gap-2">
                <Label htmlFor="custom-mcp-import">Configuração com mcpServers</Label>
                <Textarea
                  id="custom-mcp-import"
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImported([]);
                  }}
                  className="font-mono text-xs"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={importConfig}
                  disabled={!importText.trim()}
                  className="justify-self-start"
                >
                  Ler configuração
                </Button>
                {imported.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imported.map((item) => (
                      <Button key={item.name} type="button" variant="outline" onClick={() => loadImported(item)}>
                        Usar {item.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </details>
            <div className="grid gap-2">
              <Label htmlFor="custom-mcp-name">Nome</Label>
              <Input
                id="custom-mcp-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-mcp-url">URL do servidor</Label>
              <Input
                id="custom-mcp-url"
                type="url"
                placeholder="https://exemplo.com/mcp"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setTools(null);
                }}
                maxLength={2048}
              />
            </div>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Cabeçalhos HTTP (opcional)</summary>
              <div className="mt-3 grid gap-2">
                <Label htmlFor="custom-mcp-headers">Cabeçalhos em JSON</Label>
                <Textarea
                  id="custom-mcp-headers"
                  value={headers}
                  onChange={(event) => {
                    setHeaders(event.target.value);
                    setTools(null);
                  }}
                  className="font-mono text-xs"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </details>
            <Button
              type="button"
              variant="outline"
              onClick={() => void testConnection()}
              className="justify-self-start"
            >
              {busy === "testing" ? "Testando…" : "Testar conexão"}
            </Button>
            {tools !== null && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Ferramentas disponíveis para o chat</p>
                {tools.length === 0 && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Servidor conectado, sem ferramentas disponíveis.
                  </p>
                )}
                {tools.length > 0 && (
                  <ul className="grid max-h-56 gap-2 overflow-y-auto rounded-md border p-3">
                    {tools.map((tool) => (
                      <li key={tool.name}>
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 shrink-0 accent-primary"
                            checked={selected.includes(tool.name)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelected((current) =>
                                checked ? [...current, tool.name] : current.filter((name) => name !== tool.name),
                              );
                            }}
                          />
                          <span className="min-w-0 break-all">{tool.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Dialog.DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy === "saving"}>
              Cancelar
            </Button>
            <Button type="submit" disabled={Boolean(busy)}>
              {busy === "saving" ? "Salvando…" : "Salvar servidor"}
            </Button>
          </Dialog.DialogFooter>
        </form>
      </Dialog.DialogContent>
    </Dialog.DialogRoot>
  );
}
