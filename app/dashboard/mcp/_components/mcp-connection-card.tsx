"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";

import { McpConfirmDialog } from "./mcp-confirm-dialog";
import { McpCopyButton } from "./mcp-copy-button";
import { McpSnippet } from "./mcp-snippet";

//* Libraries Imports
import { useState } from "react";
import { Eye, EyeOff, KeyRound, RefreshCw, ShieldOff, SquareTerminal } from "lucide-react";

//* Types Imports
import type { McpTokenRecord } from "@/hooks/use-mcp-token";
import type { McpSnippetData } from "./mcp-snippet";

//* Utils Imports
import { formatLogDateTime } from "@/lib/mcp-logs";

type McpConnectionCardProps = {
  endpoint: string;
  token: McpTokenRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  onRegenerate: () => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
};

const MASK = "trudx_••••••••••••••••";

const SERVER_NAME = "trudx-tarefas";

/** Comandos prontos, já com o token, para colar no terminal. */
function buildTerminalCommands(endpoint: string, token: string): McpSnippetData[] {
  return [
    {
      id: "claude-code",
      title: "Claude Code",
      description:
        "Disponível em todos os projetos (--scope user). O token vai no header Authorization.",
      code: `claude mcp add --transport http --scope user ${SERVER_NAME} ${endpoint} --header "Authorization: Bearer ${token}"`,
    },
    {
      id: "codex",
      title: "Codex",
      // O Codex só lê bearer token de variável de ambiente; pela URL o comando funciona sozinho.
      description:
        "O Codex não aceita o token direto no comando, então ele vai na URL. Fica salvo em ~/.codex/config.toml.",
      code: `codex mcp add ${SERVER_NAME} --url "${endpoint}?token=${token}"`,
    },
  ];
}

function buildOtherSnippets(endpoint: string, token: string): McpSnippetData[] {
  return [
    {
      id: "url",
      title: "Claude.ai, ChatGPT e conectores que só aceitam URL",
      description:
        "Cadastre como conector MCP personalizado, sem OAuth. O token vai na própria URL: não compartilhe esse link.",
      code: `${endpoint}?token=${token}`,
    },
    {
      id: "json",
      title: "Cursor, VS Code e configurações em JSON",
      description: "Adicione em mcpServers no arquivo de configuração do editor.",
      code: JSON.stringify(
        {
          mcpServers: {
            [SERVER_NAME]: {
              type: "http",
              url: endpoint,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
    },
  ];
}

export function McpConnectionCard({
  endpoint,
  token,
  isLoading,
  isSaving,
  onRegenerate,
  onRevoke,
}: McpConnectionCardProps) {
  const [showToken, setShowToken] = useState(false);
  const [confirming, setConfirming] = useState<"regenerate" | "revoke" | null>(null);
  const visibleToken = token ? (showToken ? token.token : MASK) : "";

  function handleRegenerateClick() {
    // Sem token ainda não há nada para invalidar: gera direto.
    if (token) setConfirming("regenerate");
    else void onRegenerate();
  }

  function handleConfirm() {
    const action = confirming;
    setConfirming(null);
    if (action === "regenerate") void onRegenerate();
    if (action === "revoke") void onRevoke();
  }

  return (
    <Card.CardRoot className="gap-0 py-0">
      <Card.CardHeader className="border-b py-4">
        <Card.CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          Conexão
        </Card.CardTitle>
        <Card.CardDescription>
          Um token por conta. Gerar outro substitui o atual, e o anterior para de funcionar na hora.
        </Card.CardDescription>
      </Card.CardHeader>

      <Card.CardContent className="space-y-5 py-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mcp-endpoint">URL do servidor MCP</Label>
            <div className="flex gap-2">
              <Input id="mcp-endpoint" readOnly value={endpoint} className="font-mono text-xs" />
              <McpCopyButton value={endpoint} label="Copiar URL do MCP" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-token">Token de acesso</Label>
            <div className="flex gap-2">
              <Input
                id="mcp-token"
                readOnly
                value={isLoading ? "Carregando..." : visibleToken}
                placeholder="Nenhum token gerado"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={!token}
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                title={showToken ? "Ocultar token" : "Mostrar token"}
                onClick={() => setShowToken((current) => !current)}
              >
                {showToken ? <EyeOff /> : <Eye />}
              </Button>
              <McpCopyButton value={token?.token ?? ""} label="Copiar token" />
            </div>
            <p className="text-xs text-muted-foreground">
              {token
                ? `Gerado em ${formatLogDateTime(token.created_at)}.`
                : "Gere um token para conectar uma IA."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isLoading || isSaving}
            className="h-8 px-3 text-xs font-medium"
            onClick={handleRegenerateClick}
          >
            <RefreshCw className={isSaving ? "animate-spin" : undefined} />
            {token ? "Gerar novo token" : "Gerar token"}
          </Button>
          {token && (
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              className="h-8 px-3 text-xs font-medium"
              onClick={() => setConfirming("revoke")}
            >
              <ShieldOff />
              Revogar acesso
            </Button>
          )}
        </div>

        {token && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <SquareTerminal className="size-4 text-muted-foreground" />
              Adicionar pelo terminal
            </p>
            {buildTerminalCommands(endpoint, token.token).map((snippet) => (
              <McpSnippet
                key={snippet.id}
                snippet={snippet}
                secret={token.token}
                mask={MASK}
                showSecret={showToken}
              />
            ))}
            <p className="text-xs text-muted-foreground">
              Ao gerar um novo token, rode o comando de novo: antes, remova o anterior com{" "}
              <code className="font-mono">claude mcp remove {SERVER_NAME} --scope user</code> ou{" "}
              <code className="font-mono">codex mcp remove {SERVER_NAME}</code>.
            </p>
          </div>
        )}

        {token && (
          <details className="rounded-lg border bg-muted/30 p-4">
            <summary className="cursor-pointer text-sm font-medium">Outras IAs e editores</summary>
            <div className="mt-4 space-y-4">
              {buildOtherSnippets(endpoint, token.token).map((snippet) => (
                <McpSnippet
                  key={snippet.id}
                  snippet={snippet}
                  secret={token.token}
                  mask={MASK}
                  showSecret={showToken}
                />
              ))}
              <p className="text-xs text-muted-foreground">
                O servidor entrega um contexto fixo que obriga a IA a se identificar (claude,
                chatgpt...) em toda chamada. É esse nome que aparece no log abaixo.
              </p>
            </div>
          </details>
        )}
      </Card.CardContent>

      <McpConfirmDialog
        open={confirming === "regenerate"}
        title="Gerar novo token?"
        description="O token atual deixa de funcionar imediatamente. Todas as IAs conectadas precisarão do token novo."
        actionLabel="Gerar novo"
        onOpenChange={(open) => !open && setConfirming(null)}
        onConfirm={handleConfirm}
      />
      <McpConfirmDialog
        open={confirming === "revoke"}
        title="Revogar acesso ao MCP?"
        description="O token é apagado e nenhuma IA consegue mais acessar suas tarefas até você gerar outro."
        actionLabel="Revogar"
        onOpenChange={(open) => !open && setConfirming(null)}
        onConfirm={handleConfirm}
      />
    </Card.CardRoot>
  );
}
