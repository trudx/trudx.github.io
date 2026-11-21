"use client";

//* Components Imports
import Button from "@/components/ui/button";

//* Libraries Imports
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

type McpCopyButtonProps = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function McpCopyButton({ value, label, disabled }: McpCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Não foi possível copiar", {
        description: "Selecione o texto e copie manualmente.",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={disabled || !value}
      aria-label={label}
      title={label}
      onClick={() => void handleCopy()}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
