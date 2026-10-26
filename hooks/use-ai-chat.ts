"use client";

//* Libraries Imports
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

//* Hooks Imports
import { useAiSettings } from "@/hooks/use-ai-settings";
import { notifyAppDataChanged } from "@/hooks/use-app-data-refresh";

//* Services Imports
import * as api from "@/services/api-service";
import { getAuthenticatedUserId } from "@/services/auth-service";

//* Types Imports
import type { AiMessage, ChatEntry, ToolActivity } from "@/lib/ai/types";

//* Utils Imports
import { createInternalMcp, MCP_TOOLS } from "@/lib/ai/mcp";
import { runAiTurn } from "@/lib/ai/agent";
import {
  deleteAiChat,
  newAiChat,
  parseSavedAiChats,
  readAiChats,
  restoredChatContext,
  restoreChatEntries,
  saveAiChat,
  savedAiChatsSnapshot,
  subscribeAiChats,
} from "@/lib/ai/chat-store";
import { deleteRemoteChat, pushRemoteChat } from "@/lib/ai/remote-store";
import { createDiagnosticLogger } from "@/lib/browser-logs";

export function useAiChat() {
  const { userId, settings } = useAiSettings();
  const [initialChat] = useState(() => (userId ? readAiChats(userId)[0] : null) ?? newAiChat());
  const [chatId, setChatId] = useState(initialChat.id);
  const [createdAt, setCreatedAt] = useState(initialChat.createdAt);
  const [entries, setEntries] = useState<ChatEntry[]>(() =>
    restoreChatEntries(initialChat.entries),
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const initialHistory = useMemo(() => restoredChatContext(initialChat.entries), [initialChat]);
  const history = useRef<AiMessage[]>(initialHistory);
  const subscribe = useCallback(
    (listener: () => void) => (userId ? subscribeAiChats(userId, listener) : () => {}),
    [userId],
  );
  const snapshot = useCallback(() => (userId ? savedAiChatsSnapshot(userId) : ""), [userId]);
  const serializedChats = useSyncExternalStore(subscribe, snapshot, () => "");
  const savedChats = useMemo(() => parseSavedAiChats(serializedChats), [serializedChats]);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const configuration = useRef(`${settings.provider}:${settings.model}`);
  const dispatch = useMemo(
    () =>
      userId
        ? createInternalMcp({
            api,
            userId,
            getUserId: getAuthenticatedUserId,
            onChanged: notifyAppDataChanged,
          })
        : null,
    [userId],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  useEffect(
    () => () => controller.current?.abort(),
    [settings.provider, settings.model, settings.token],
  );

  useEffect(() => {
    if (!userId || !entries.length) return;
    try {
      saveAiChat(userId, {
        id: chatId,
        createdAt,
        updatedAt: new Date().toISOString(),
        title: entries.find((entry) => entry.role === "user")?.content.slice(0, 80) ?? "Conversa",
        entries,
      });
      // Feedback de uma escrita no armazenamento externo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(null);
    } catch {
      setStorageError(
        "Não foi possível salvar o histórico neste navegador. A conversa está apenas na memória desta aba.",
      );
    }
  }, [entries, userId, chatId, createdAt]);

  // Envia a conversa (já com segredos removidos) para a conta; o debounce evita uma escrita por trecho
  // de texto durante a resposta.
  useEffect(() => {
    if (!userId || !entries.length) return;
    const timer = setTimeout(() => {
      const saved = readAiChats(userId).find((chat) => chat.id === chatId);
      if (saved)
        pushRemoteChat(userId, saved).catch((error) =>
          console.error("Erro ao sincronizar a conversa com a conta:", error),
        );
    }, 1500);
    return () => clearTimeout(timer);
  }, [entries, userId, chatId]);

  function updateAssistant(id: string, change: Partial<ChatEntry>) {
    if (mounted.current)
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
      );
  }

  async function send(content: string) {
    if (controller.current || !content.trim() || !dispatch || !userId) return false;
    if (!settings.token.trim()) return false;
    if (content.trim().length > 12000) return false;
    const log = createDiagnosticLogger();
    const signature = `${settings.provider}:${settings.model}`;
    if (configuration.current !== signature) {
      // Históricos assinados e itens de raciocínio não são portáveis entre provedores/modelos.
      history.current = history.current
        .filter((message) => message.role !== "tool" && message.content)
        .map((message) => ({ role: message.role, content: message.content }));
      configuration.current = signature;
    }
    const abort = new AbortController();
    controller.current = abort;
    setIsRunning(true);
    const assistantId = crypto.randomUUID();
    setEntries((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: content.trim() },
      { id: assistantId, role: "assistant", content: "", activities: [] },
    ]);
    history.current.push({ role: "user", content: content.trim() });
    let lastText = "";
    try {
      await runAiTurn({
        settings,
        messages: history.current,
        tools: MCP_TOOLS,
        dispatch,
        signal: abort.signal,
        assertSession: async () => {
          if ((await getAuthenticatedUserId()) !== userId)
            throw new Error("Sua conta mudou. Abra uma nova conversa.");
        },
        onText: (text) => {
          lastText = text;
          updateAssistant(assistantId, { content: text });
        },
        onActivity: (activity: ToolActivity) => {
          if (!mounted.current) return;
          if (activity.status !== "running")
            log({
              level: activity.status === "error" ? "error" : "info",
              source: "ai.tool",
              message: `${activity.name}: ${activity.status}`,
              details: activity.detail,
            });
          setEntries((current) =>
            current.map((entry) => {
              if (entry.id !== assistantId) return entry;
              const activities = [...(entry.activities ?? [])];
              const index = activities.findIndex((item) => item.id === activity.id);
              if (index === -1) activities.push(activity);
              else activities[index] = activity;
              return { ...entry, activities };
            }),
          );
        },
      });
    } catch (error) {
      log({
        level: "error",
        source: "ai.chat",
        message: abort.signal.aborted ? "Conversa interrompida" : "Falha ao executar conversa",
        details: error,
      });
      const message = abort.signal.aborted
        ? "Execução interrompida. As ações já concluídas continuam salvas."
        : error instanceof Error && error.name === "TimeoutError"
          ? "O provedor demorou demais para responder. Confira as ações realizadas antes de tentar novamente."
          : error instanceof TypeError
            ? "Ocorreu um erro interno ao processar a conversa. Abra os logs do navegador para ver a origem; isso não confirma uma falha de conexão."
            : error instanceof Error
              ? error.message
              : "Não foi possível concluir a mensagem.";
      updateAssistant(assistantId, {
        content: [lastText, message].filter(Boolean).join("\n\n"),
        error: !abort.signal.aborted,
      });
    } finally {
      if (controller.current === abort) controller.current = null;
      if (mounted.current) setIsRunning(false);
    }
    return true;
  }

  function clearConversation() {
    if (controller.current) return;
    try {
      if (userId) {
        deleteAiChat(userId, chatId);
        deleteRemoteChat(userId, chatId).catch((error) =>
          console.error("Erro ao excluir a conversa da conta:", error),
        );
      }
    } catch {
      setStorageError("Não foi possível excluir a conversa salva.");
      return;
    }
    newConversation();
  }

  function newConversation() {
    if (controller.current) return;
    const chat = newAiChat();
    setChatId(chat.id);
    setCreatedAt(chat.createdAt);
    setEntries([]);
    setStorageError(null);
    history.current = [];
  }

  function openConversation(id: string) {
    if (controller.current) return;
    const chat = savedChats.find((current) => current.id === id);
    if (!chat) return;
    setChatId(chat.id);
    setCreatedAt(chat.createdAt);
    setEntries(restoreChatEntries(chat.entries));
    setStorageError(null);
    history.current = restoredChatContext(chat.entries);
    configuration.current = `${settings.provider}:${settings.model}`;
  }

  return {
    entries,
    isRunning,
    send,
    stop: () => controller.current?.abort(),
    clearConversation,
    newConversation,
    openConversation,
    savedChats,
    chatId,
    storageError,
  };
}
