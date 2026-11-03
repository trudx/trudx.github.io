"use client";

//* Components Imports
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import Textarea from "@/components/ui/textarea";
import { AiChatMessage } from "./ai-chat-message";
import { BrowserLogsDialog } from "@/components/browser-logs-dialog";

//* Libraries Imports
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import {
  Bot,
  History,
  ImagePlus,
  MessageCircle,
  Plus,
  Send,
  Settings2,
  Square,
  Trash2,
  X,
} from "lucide-react";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";
import { useAiChat } from "@/hooks/use-ai-chat";

//* Types Imports
import type { ClipboardEvent, FormEvent } from "react";
import type { AiProviderId } from "@/lib/ai/types";

//* Utils Imports
import { AI_PROVIDERS, modelAcceptsImages, modelName, switchAiProvider } from "@/lib/ai/models";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_CHAT_IMAGES,
  imageFileToDataUrl,
  imageUnsupportedMessage,
} from "@/lib/ai/images";

const SUGGESTIONS = [
  "Quais tarefas vencem nesta semana?",
  "Analise minhas despesas deste mês",
  "Me ajude a organizar minha agenda",
];

export function AiChatPanel() {
  const { settings, userId, saveSettings } = useAiSettings();
  const {
    entries,
    isRunning,
    send,
    stop,
    clearConversation,
    newConversation,
    openConversation,
    savedChats,
    chatId,
    storageError,
  } = useAiChat();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = Boolean(userId && settings.token.trim() && settings.model.trim());
  const acceptsImages = modelAcceptsImages(settings);
  const provider = AI_PROVIDERS[settings.provider];
  const models = provider.models.some((model) => model.id === settings.model)
    ? provider.models
    : [...provider.models, { id: settings.model, name: settings.model, vision: false }];

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, open]);

  async function addImages(files: File[]) {
    if (!files.length) return;
    if (acceptsImages === false) {
      setNotice(imageUnsupportedMessage(modelName(settings)));
      return;
    }
    const room = MAX_CHAT_IMAGES - images.length;
    if (room <= 0) {
      setNotice(`Envie no máximo ${MAX_CHAT_IMAGES} imagens por mensagem.`);
      return;
    }
    try {
      const added = await Promise.all(files.slice(0, room).map(imageFileToDataUrl));
      setImages((current) => [...current, ...added].slice(0, MAX_CHAT_IMAGES));
      setNotice(
        files.length > room ? `Envie no máximo ${MAX_CHAT_IMAGES} imagens por mensagem.` : null,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível anexar a imagem.");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    // Texto copiado do Office/planilhas também traz uma imagem; nesse caso cola só o texto.
    if (!files.length || event.clipboardData.getData("text/plain")) return;
    event.preventDefault();
    void addImages(files);
  }

  async function changeModel(next: Parameters<typeof saveSettings>[0]) {
    if (isRunning) return;
    try {
      await saveSettings(next);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível trocar o modelo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || isRunning || (!input.trim() && !images.length)) return;
    if (images.length && acceptsImages === false) {
      setNotice(imageUnsupportedMessage(modelName(settings)));
      return;
    }
    const content = input;
    const attached = images;
    setInput("");
    setImages([]);
    setNotice(null);
    const accepted = await send(content, attached);
    if (!accepted) {
      setInput(content);
      setImages(attached);
    }
    composer.current?.focus();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
      <Dialog.Trigger
        render={
          <Button
            type="button"
            size="icon"
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-12 rounded-full shadow-lg sm:right-6 sm:bottom-6"
            aria-label={open ? "Fechar assistente IA" : "Abrir assistente IA"}
          />
        }
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup
          initialFocus={composer}
          className="fixed inset-x-2 bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4rem))] z-40 flex h-[min(40rem,calc(100dvh-6rem))] min-h-0 flex-col overflow-hidden rounded-2xl border bg-background text-foreground shadow-2xl outline-none sm:inset-x-auto sm:right-6 sm:bottom-22 sm:w-[26rem]"
        >
          <div className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted">
              <Bot className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold">Assistente Trudx</Dialog.Title>
              <Dialog.Description className="truncate text-[0.65rem] text-muted-foreground">
                {ready ? modelName(settings) : "Conecte seu modelo para começar"}
              </Dialog.Description>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isRunning}
              onClick={newConversation}
              aria-label="Nova conversa"
            >
              <Plus className="size-4" />
            </Button>
            <BrowserLogsDialog compact />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={isRunning || !entries.length}
              onClick={clearConversation}
              aria-label="Excluir conversa salva"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              render={
                <Link href="/dashboard/settings#assistente-ia" onClick={() => setOpen(false)} />
              }
              aria-label="Configurar assistente"
            >
              <Settings2 className="size-4" />
            </Button>
            <Dialog.Close
              render={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar chat" />
              }
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
            <History className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Abrir uma das últimas três conversas"
              value={chatId}
              disabled={isRunning}
              onChange={(event) => openConversation(event.target.value)}
              className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              {!savedChats.some((chat) => chat.id === chatId) && (
                <option value={chatId}>Nova conversa</option>
              )}
              {savedChats.map((chat) => (
                <option key={chat.id} value={chat.id}>
                  {chat.title}
                </option>
              ))}
            </select>
            <span className="text-[0.6rem] text-muted-foreground">
              {savedChats.length}/3 salvas
            </span>
          </div>
          {userId && (
            <div className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-2">
              <Select.SelectRoot
                value={settings.provider}
                disabled={isRunning}
                onValueChange={(value) => {
                  if (!value || value === settings.provider || !Object.hasOwn(AI_PROVIDERS, value))
                    return;
                  void changeModel(switchAiProvider(settings, value as AiProviderId));
                }}
              >
                <Select.SelectTrigger
                  size="sm"
                  aria-label="Provedor da IA"
                  className="w-full min-w-0 text-xs"
                >
                  <Select.SelectValue>{provider.name}</Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([id, option]) => {
                    const hasToken = Boolean(settings.tokens[id as AiProviderId]);
                    return (
                      <Select.SelectItem key={id} value={id} disabled={!hasToken}>
                        {option.name}
                        {hasToken ? "" : " · sem token"}
                      </Select.SelectItem>
                    );
                  })}
                </Select.SelectContent>
              </Select.SelectRoot>
              <Select.SelectRoot
                value={settings.model}
                disabled={isRunning || !settings.token}
                onValueChange={(value) => {
                  if (!value || value === settings.model) return;
                  void changeModel({ ...settings, model: value });
                }}
              >
                <Select.SelectTrigger
                  size="sm"
                  aria-label="Modelo da IA"
                  className="w-full min-w-0 text-xs"
                >
                  <Select.SelectValue>{modelName(settings)}</Select.SelectValue>
                </Select.SelectTrigger>
                <Select.SelectContent>
                  {models.map((model) => (
                    <Select.SelectItem key={model.id} value={model.id}>
                      {model.name}
                      {model.vision ? " · imagem" : ""}
                    </Select.SelectItem>
                  ))}
                </Select.SelectContent>
              </Select.SelectRoot>
            </div>
          )}
          {storageError && (
            <p role="alert" className="px-4 py-2 text-xs text-destructive">
              {storageError}
            </p>
          )}
          <div
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Conversa com o assistente"
          >
            {!entries.length && (
              <div className="flex h-full flex-col justify-center gap-5 py-6">
                <div>
                  <p className="text-lg font-semibold tracking-tight">Como posso ajudar?</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Posso organizar tarefas, ajustar sua agenda e analisar suas finanças com os
                    dados do app.
                  </p>
                </div>
                {ready ? (
                  <div className="space-y-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="block w-full rounded-xl border px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => {
                          setInput(suggestion);
                          composer.current?.focus();
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Escolha o provedor e o modelo e salve seu token nas configurações.
                    </p>
                    <Button
                      render={
                        <Link
                          href="/dashboard/settings#assistente-ia"
                          onClick={() => setOpen(false)}
                        />
                      }
                    >
                      Configurar IA
                    </Button>
                  </div>
                )}
              </div>
            )}
            {entries.map((entry, index) => (
              <AiChatMessage
                key={entry.id}
                entry={entry}
                pending={isRunning && index === entries.length - 1 && entry.role === "assistant"}
              />
            ))}
            <div ref={bottom} />
          </div>
          <form className="shrink-0 space-y-2 border-t bg-card p-3" onSubmit={handleSubmit}>
            <label htmlFor="ai-chat-input" className="sr-only">
              Mensagem para o assistente
            </label>
            {notice && (
              <p role="alert" className="text-xs leading-5 text-destructive">
                {notice}
              </p>
            )}
            {Boolean(images.length) && (
              <div className="flex flex-wrap gap-1.5">
                {images.map((url, index) => (
                  <div key={index} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização do Next. */}
                    <img
                      src={url}
                      alt={`Imagem anexada ${index + 1}`}
                      className="size-14 rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remover imagem ${index + 1}`}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-sm"
                      onClick={() =>
                        setImages((current) => current.filter((_, position) => position !== index))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              hidden
              onChange={(event) => {
                void addImages(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={!ready || isRunning}
                onClick={() => {
                  if (acceptsImages === false)
                    setNotice(imageUnsupportedMessage(modelName(settings)));
                  else fileInput.current?.click();
                }}
                aria-label="Anexar imagem"
                title={
                  acceptsImages === false
                    ? "Este modelo não aceita imagens"
                    : "Anexar imagem (ou cole com Ctrl+V)"
                }
              >
                <ImagePlus className="size-4" />
              </Button>
              <Textarea
                ref={composer}
                id="ai-chat-input"
                placeholder={
                  ready ? "Peça algo ao seu assistente..." : "Configure a IA para conversar"
                }
                disabled={!ready}
                value={input}
                maxLength={12000}
                rows={2}
                className="max-h-36 min-h-18 resize-y bg-background text-sm"
                onChange={(event) => setInput(event.target.value)}
                onPaste={handlePaste}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!isRunning) event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {isRunning ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={stop}
                  aria-label="Interromper execução"
                >
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!ready || (!input.trim() && !images.length)}
                  aria-label="Enviar mensagem"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
            <p className="text-[0.65rem] leading-4 text-muted-foreground">
              A IA pode alterar seus dados quando você pedir. Mensagens e consultas são enviadas ao
              provedor.
            </p>
            <p className="text-[0.6rem] text-muted-foreground">
              Últimas 3 conversas salvas na sua conta, com até 40 mensagens por conversa.
            </p>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
