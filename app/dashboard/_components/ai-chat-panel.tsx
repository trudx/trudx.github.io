"use client";

//* Components Imports
import Button from "@/components/ui/button";
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
import type { FormEvent } from "react";

const SUGGESTIONS = [
  "Quais tarefas vencem nesta semana?",
  "Analise minhas despesas deste mês",
  "Me ajude a organizar minha agenda",
];

export function AiChatPanel() {
  const { settings, userId } = useAiSettings();
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
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const ready = Boolean(userId && settings.token.trim() && settings.model.trim());

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || isRunning || !input.trim()) return;
    const content = input;
    setInput("");
    const accepted = await send(content);
    if (!accepted) setInput(content);
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
                {ready ? settings.model : "Conecte seu modelo para começar"}
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
            <div className="flex items-end gap-2">
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
                  disabled={!ready || !input.trim()}
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
