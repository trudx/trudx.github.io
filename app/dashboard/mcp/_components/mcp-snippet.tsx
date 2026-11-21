"use client";

//* Components Imports
import { McpCopyButton } from "./mcp-copy-button";

export type McpSnippetData = {
  id: string;
  title: string;
  description: string;
  code: string;
};

type McpSnippetProps = {
  snippet: McpSnippetData;
  /** Texto trocado pela máscara enquanto o token está oculto; a cópia leva sempre o valor real. */
  secret: string;
  mask: string;
  showSecret: boolean;
};

export function McpSnippet({ snippet, secret, mask, showSecret }: McpSnippetProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{snippet.title}</p>
      <p className="text-xs text-muted-foreground">{snippet.description}</p>
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-background p-3 font-mono text-[0.7rem] leading-5">
          {showSecret ? snippet.code : snippet.code.replaceAll(secret, mask)}
        </pre>
        <McpCopyButton value={snippet.code} label={`Copiar: ${snippet.title}`} />
      </div>
    </div>
  );
}
