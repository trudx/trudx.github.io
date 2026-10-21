//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Types Imports
import type { AiMessage, ToolActivity } from "../lib/ai/types.ts";

//* Utils Imports
import { decodeToolArguments, runAiTurn } from "../lib/ai/agent.ts";
import { MCP_TOOLS } from "../lib/ai/mcp.ts";

function toolResponse(ids = ["call1"]): AiMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: ids.map((id) => ({
      id,
      type: "function",
      function: { name: "records_list", arguments: '{"resource":"tasks"}' },
    })),
  };
}

function setup() {
  const messages: AiMessage[] = [{ role: "user", content: "Liste minhas tarefas" }];
  const activities: ToolActivity[] = [];
  const text: string[] = [];
  const requests: unknown[] = [];
  const controller = new AbortController();
  const options: Parameters<typeof runAiTurn>[0] = {
    settings: { provider: "openai", model: "gpt-6.1-sol", token: "test" },
    messages,
    tools: MCP_TOOLS,
    signal: controller.signal,
    assertSession: async () => {},
    onActivity: (activity) => activities.push(activity),
    onText: (value) => text.push(value),
    dispatch: async (request) => {
      requests.push(request);
      return { result: { isError: false, content: [{ type: "text", text: "[]" }] } };
    },
  };
  return { options, messages, activities, text, requests, controller };
}

describe("ciclo do assistente", () => {
  it("decodifica dados do Gemini e mantém o contrato de objetos do MCP", () => {
    assert.deepEqual(
      decodeToolArguments(
        "record_update",
        JSON.stringify({
          resource: "tasks",
          id: "id",
          data: JSON.stringify({ title: "Nova tarefa" }),
        }),
      ),
      { resource: "tasks", id: "id", data: { title: "Nova tarefa" } },
    );
    assert.deepEqual(
      decodeToolArguments(
        "records_list",
        JSON.stringify({ resource: "tasks", filters: JSON.stringify({ priority: "high" }) }),
      ),
      { resource: "tasks", filters: { priority: "high" } },
    );
    assert.throws(() => decodeToolArguments("record_update", "[]"));
  });
  it("consulta ferramentas, devolve resultados ao modelo e só então responde", async () => {
    const state = setup();
    const sequence = [
      toolResponse(),
      { role: "assistant", content: "Você não possui tarefas." } as AiMessage,
    ];
    state.options.request = async (_settings, messages) => {
      if (sequence.length === 1) assert.equal(messages.at(-1)?.role, "tool");
      return sequence.shift()!;
    };
    await runAiTurn(state.options);
    assert.equal(state.requests.length, 1);
    assert.deepEqual(state.text, ["Você não possui tarefas."]);
    assert.deepEqual(
      state.activities.map((activity) => activity.status),
      ["running", "success"],
    );
  });

  it("permite que o modelo corrija argumentos inválidos sem executar a chamada", async () => {
    const state = setup();
    const invalid = toolResponse();
    invalid.tool_calls![0].function.arguments = "broken JSON";
    const sequence = [
      invalid,
      { role: "assistant", content: "Não consegui consultar." } as AiMessage,
    ];
    state.options.request = async () => sequence.shift()!;
    await runAiTurn(state.options);
    assert.equal(state.requests.length, 0);
    assert.equal(state.activities.at(-1)?.status, "error");
    assert.equal(state.messages[2].role, "tool");
  });

  it("separa IDs de chamadas reutilizados pelo provedor em etapas diferentes", async () => {
    const state = setup();
    const sequence = [
      toolResponse(),
      toolResponse(),
      { role: "assistant", content: "Concluído" } as AiMessage,
    ];
    state.options.request = async () => sequence.shift()!;
    await runAiTurn(state.options);
    const ids = state.requests.map((request) => (request as { id: string }).id);
    assert.equal(new Set(ids).size, 2);
    assert.equal(state.messages.filter((message) => message.role === "tool").length, 2);
    assert.equal(new Set(state.activities.map((activity) => activity.id)).size, 2);
  });

  it("interrompe antes das próximas ações e fecha o histórico de chamadas pendentes", async () => {
    const state = setup();
    state.options.request = async () => toolResponse(["call1", "call2"]);
    state.options.dispatch = async (request) => {
      state.requests.push(request);
      state.controller.abort();
      return { result: { isError: false, content: [{ type: "text", text: "Salvo" }] } };
    };
    await assert.rejects(runAiTurn(state.options));
    assert.equal(state.requests.length, 1);
    assert.equal(state.messages.filter((message) => message.role === "tool").length, 2);
    assert.equal(state.activities.at(-1)?.status, "error");
    assert.match(state.messages.at(-1)?.content ?? "", /interrompida/);
  });

  it("não executa ferramentas após troca de conta durante a resposta", async () => {
    const state = setup();
    let checks = 0;
    state.options.assertSession = async () => {
      if (++checks > 1) throw new Error("Conta mudou");
    };
    state.options.request = async () => toolResponse();
    await assert.rejects(runAiTurn(state.options), /Conta mudou/);
    assert.equal(state.requests.length, 0);
  });

  it("preserva ações concluídas quando a próxima chamada ao provedor falha", async () => {
    const state = setup();
    let requests = 0;
    state.options.request = async () => {
      if (++requests > 1) throw new Error("Offline");
      return toolResponse();
    };
    await assert.rejects(runAiTurn(state.options), /Offline/);
    assert.equal(state.activities.at(-1)?.status, "success");
    assert.equal(state.messages.at(-1)?.role, "tool");
    assert.match(state.messages.at(-1)?.content ?? "", /false/);
  });

  it("limita sequências intermináveis de chamadas", async () => {
    const state = setup();
    let round = 0;
    state.options.request = async () => toolResponse([`call${round++}`]);
    await assert.rejects(runAiTurn(state.options), /Limite de etapas/);
    assert.equal(state.requests.length, 16);
  });
});
