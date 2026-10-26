"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Select from "@/components/ui/select";
import { SettingsSection } from "./settings-section";

//* Libraries Imports
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";

//* Services Imports
import { testAiConnection } from "@/services/ai-service";

//* Types Imports
import type { FormEvent } from "react";
import type { AiProviderId } from "@/lib/ai/types";

//* Utils Imports
import { AI_PROVIDERS } from "@/lib/ai/models";

export function AiSettingsSetting() {
  const { userId, settings, isLoading, saveSettings, clearSettings } = useAiSettings();
  const [draft, setDraft] = useState(settings);
  const [previousSettings, setPreviousSettings] = useState(settings);
  const [custom, setCustom] = useState(
    !AI_PROVIDERS[settings.provider].models.some((model) => model.id === settings.model),
  );
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const controller = useRef<AbortController | null>(null);

  if (settings !== previousSettings) {
    setPreviousSettings(settings);
    setDraft(settings);
    setCustom(!AI_PROVIDERS[settings.provider].models.some((model) => model.id === settings.model));
    setTested(false);
    setShowToken(false);
  }

  useEffect(() => () => controller.current?.abort(), [userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!draft.token.trim() || !draft.model.trim())
        throw new Error("Informe o token e o modelo.");
      await saveSettings(draft);
      toast.success("Configuração da IA salva na sua conta");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      );
    }
  }

  async function handleTest() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setIsTesting(true);
    setTested(false);
    try {
      await testAiConnection(draft, abort.signal);
      if (abort.signal.aborted) return;
      setTested(true);
      toast.success("Conexão com o modelo funcionando");
    } catch (error) {
      if (!abort.signal.aborted)
        toast.error(
          error instanceof Error ? error.message : "Não foi possível conectar ao provedor.",
        );
    } finally {
      if (controller.current === abort) {
        setIsTesting(false);
        controller.current = null;
      }
    }
  }

  const provider = AI_PROVIDERS[draft.provider];
  return (
    <SettingsSection
      title="Assistente IA"
      description="Seu ajudante para tarefas, agenda, clientes e financeiro."
      icon={Bot}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={isLoading || isTesting || !userId} className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">Provedor</Label>
              <Select.SelectRoot
                value={draft.provider}
                onValueChange={(value) => {
                  if (!value || !Object.hasOwn(AI_PROVIDERS, value)) return;
                  const next = value as AiProviderId;
                  if (next === draft.provider) return;
                  setDraft({ provider: next, model: AI_PROVIDERS[next].models[0].id, token: "" });
                  setCustom(false);
                  setTested(false);
                }}
              >
                <Select.SelectTrigger id="ai-provider" className="h-10 w-full bg-background">
                  <Select.SelectValue>{provider.name}</Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([id, option]) => (
                    <Select.SelectItem key={id} value={id}>
                      {option.name}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">Modelo</Label>
              <Select.SelectRoot
                value={custom ? "custom" : draft.model}
                onValueChange={(value) => {
                  if (!value) return;
                  setCustom(value === "custom");
                  setDraft((current) => ({ ...current, model: value === "custom" ? "" : value }));
                  setTested(false);
                }}
              >
                <Select.SelectTrigger id="ai-model" className="h-10 w-full bg-background">
                  <Select.SelectValue>
                    {custom
                      ? "Personalizado"
                      : (provider.models.find((model) => model.id === draft.model)?.name ??
                        draft.model)}
                  </Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {provider.models.map((model) => (
                    <Select.SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </Select.SelectItem>
                  ))}
                  <Select.SelectItem value="custom">Personalizado...</Select.SelectItem>
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          </div>
          {custom && (
            <div className="space-y-2">
              <Label htmlFor="ai-custom-model">ID do modelo personalizado</Label>
              <Input
                id="ai-custom-model"
                required
                maxLength={200}
                value={draft.model}
                placeholder={
                  draft.provider === "openrouter" ? "provedor/nome-do-modelo" : "nome-do-modelo"
                }
                onChange={(event) => {
                  setDraft((current) => ({ ...current, model: event.target.value }));
                  setTested(false);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Use o ID da API de um modelo com suporte a ferramentas (function calling).
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ai-token">Token da API</Label>
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-4"
              >
                Obter token do provedor
              </a>
            </div>
            <div className="relative">
              <Input
                id="ai-token"
                type={showToken ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={4096}
                value={draft.token}
                placeholder="Cole a chave da API do provedor escolhido"
                className="h-10 pr-12"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, token: event.target.value }));
                  setTested(false);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                className="absolute top-1 right-1"
                onClick={() => setShowToken((current) => !current)}
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
            <p>
              O token, o modelo e as últimas três conversas ficam salvos na sua conta, para
              valer em todos os seus dispositivos. O token é enviado somente ao provedor escolhido.
              As mensagens e os dados consultados pelo assistente também são enviados a ele.
            </p>
            <p className="mt-1">
              Use uma chave pessoal com limite de gastos. O uso da API, incluindo o teste de
              conexão, pode consumir créditos; a assinatura do chat do provedor não substitui
              créditos de API.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={!settings.token}
              onClick={async () => {
                try {
                  await clearSettings();
                  toast.success("Token removido da sua conta");
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Não foi possível remover o token.",
                  );
                }
              }}
            >
              Remover configuração
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!draft.token.trim() || !draft.model.trim()}
                onClick={() => void handleTest()}
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : tested ? (
                  <Check className="size-4" />
                ) : null}
                {isTesting ? "Testando..." : "Testar conexão"}
              </Button>
              <Button type="submit">Salvar IA</Button>
            </div>
          </div>
        </fieldset>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Modelos e ferramentas disponíveis</summary>
          <div className="mt-3 space-y-2 leading-5">
            <p>
              O assistente consulta e altera tarefas, colunas, clientes, eventos, lançamentos,
              gastos fixos, bancos, categorias e grupos. Também analisa o financeiro, consulta
              saldos e controla o cronômetro.
            </p>
            <p>
              Seleção de modelos consultada em 21/10/2026:{" "}
              <a
                href="https://developers.openai.com/api/docs/models"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                OpenAI
              </a>
              ,{" "}
              <a
                href="https://platform.claude.com/docs/en/models/overview"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Claude
              </a>
              ,{" "}
              <a
                href="https://ai.google.dev/gemini-api/docs/models"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Gemini
              </a>
              ,{" "}
              <a
                href="https://api-docs.deepseek.com/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                DeepSeek
              </a>{" "}
              e{" "}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                OpenRouter
              </a>
              . Disponibilidade depende da conta do provedor.
            </p>
            <a href="/ai/mcp.json" download className="inline-block underline underline-offset-4">
              Baixar catálogo MCP interno (JSON)
            </a>
          </div>
        </details>
      </form>
    </SettingsSection>
  );
}
