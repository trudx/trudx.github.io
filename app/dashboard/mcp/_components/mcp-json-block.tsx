"use client";

//* Components Imports
import { McpCopyButton } from "./mcp-copy-button";

type McpJsonBlockProps = { title: string; value: unknown };

export function McpJsonBlock({ title, value }: McpJsonBlockProps) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <McpCopyButton value={text} label={`Copiar ${title.toLowerCase()}`} />
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[0.7rem] leading-5">
        {text}
      </pre>
    </div>
  );
}
