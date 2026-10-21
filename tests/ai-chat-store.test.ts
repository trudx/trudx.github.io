//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Types Imports
import type { ChatEntry } from "../lib/ai/types.ts";

//* Utils Imports
import {
  aiChatsKey,
  deleteAiChat,
  newAiChat,
  parseSavedAiChats,
  readAiChats,
  restoredChatContext,
  restoreChatEntries,
  saveAiChat,
} from "../lib/ai/chat-store.ts";
import { withLocalStorage } from "./helpers/local-storage.ts";

function entry(content: string, role: "user" | "assistant" = "user"): ChatEntry {
  return { id: crypto.randomUUID(), role, content };
}

describe("últimas três conversas", () => {
  it("persiste três por conta e remove a mais antiga quando chega uma quarta", async () => {
    await withLocalStorage((values) => {
      const ids: string[] = [];
      for (let index = 0; index < 4; index++) {
        const chat = {
          ...newAiChat(),
          updatedAt: `2026-10-21T12:0${index}:00.000Z`,
          entries: [entry(`Chat ${index}`)],
        };
        ids.push(chat.id);
        saveAiChat("user", chat);
      }
      const saved = readAiChats("user");
      assert.equal(saved.length, 3);
      assert.deepEqual(
        saved.map((chat) => chat.id),
        ids.slice(1).reverse(),
      );
      assert.equal(JSON.parse(values.get(aiChatsKey("user"))!).length, 3);
      assert.deepEqual(readAiChats("other-user"), []);
    });
  });

  it("atualiza sem duplicar e permite apagar uma conversa sem apagar as outras", async () => {
    await withLocalStorage(() => {
      const first = { ...newAiChat(), entries: [entry("Primeiro")] };
      const second = { ...newAiChat(), entries: [entry("Segundo")] };
      saveAiChat("user", first);
      saveAiChat("user", second);
      saveAiChat("user", { ...first, entries: [...first.entries, entry("Resposta", "assistant")] });
      assert.equal(readAiChats("user").length, 2);
      assert.equal(readAiChats("user").find((chat) => chat.id === first.id)?.entries.length, 2);
      deleteAiChat("user", first.id);
      assert.deepEqual(
        readAiChats("user").map((chat) => chat.id),
        [second.id],
      );
    });
  });

  it("limita mensagens e tamanho; conversa vazia não remove uma conversa salva", async () => {
    await withLocalStorage(() => {
      const chat = {
        ...newAiChat(),
        entries: Array.from({ length: 50 }, (_, index) => entry(`${index}: ${"x".repeat(10000)}`)),
      };
      saveAiChat("user", chat);
      saveAiChat("user", newAiChat());
      const saved = readAiChats("user");
      assert.equal(saved.length, 1);
      assert.equal(saved[0].entries.length, 40);
      assert.ok(saved[0].entries[0].content.startsWith("10:"));
      assert.equal(saved[0].entries[0].content.length, 4000);
      assert.ok((restoredChatContext(saved[0].entries)[0].content?.length ?? 0) < 49000);
    });
  });

  it("restaura contexto sem reenviar chamadas antigas ou metadados do provedor", () => {
    const entries = [
      entry("Exclua a tarefa"),
      {
        ...entry("Tarefa excluída", "assistant"),
        activities: [{ id: "action", name: "record_delete", status: "success" as const }],
      },
    ];
    const context = restoredChatContext(entries);
    assert.equal(context.length, 1);
    assert.equal(context[0].role, "user");
    assert.ok(!Object.hasOwn(context[0], "tool_calls"));
    assert.match(context[0].content ?? "", /NÃO devem ser repetidas/);
    assert.match(context[0].content ?? "", /Tarefa excluída/);
  });

  it("identifica ações interrompidas após recarregar e preserva as concluídas", () => {
    const entries: ChatEntry[] = [
      {
        ...entry("", "assistant"),
        activities: [
          { id: "done", name: "record_update", status: "success" },
          { id: "pending", name: "record_create", status: "running" },
        ],
      },
    ];
    const restored = restoreChatEntries(entries);
    assert.match(restored[0].content, /interrompida/);
    assert.equal(restored[0].activities?.[0].status, "success");
    assert.equal(restored[0].activities?.[1].status, "error");
    assert.equal(restored[0].error, true);
    assert.deepEqual(parseSavedAiChats("broken JSON"), []);
    assert.deepEqual(parseSavedAiChats('[{"id":"invalid"}]'), []);
  });
});
