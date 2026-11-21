//* Libraries Imports
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

//* Types Imports
import type {
  ClientRow,
  ColumnRow,
  FlagRow,
  TaskRow,
  TaskStore,
  TaskWrite,
} from "../supabase/functions/mcp/store.ts";

//* Utils Imports
import {
  handleRpcMessage,
  inferAgentFromClient,
  SERVER_INSTRUCTIONS,
} from "../supabase/functions/mcp/protocol.ts";
import { todayIn } from "../supabase/functions/mcp/tools.ts";

const COLUMN_TODO = "11111111-1111-4111-8111-111111111111";
const COLUMN_DONE = "22222222-2222-4222-8222-222222222222";
const FLAG = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const TODAY = "2026-11-21";

function createMemoryStore() {
  const columns: ColumnRow[] = [
    { id: COLUMN_TODO, name: "A fazer", stage: "pending", position: 0 },
    { id: COLUMN_DONE, name: "Feito", stage: "done", position: 1 },
  ];
  const flags: FlagRow[] = [{ id: FLAG, name: "Urgente", color: "#ff0000" }];
  const clients: ClientRow[] = [{ id: CLIENT, name: "ACME", status: "active" }];
  const tasks = new Map<string, TaskRow>();
  let sequence = 0;

  const store: TaskStore = {
    listColumns: async () => columns,
    listFlags: async () => flags,
    listClients: async () => clients,
    async listTasks(filters) {
      const rows = [...tasks.values()].filter(
        (task) =>
          (!filters.column_id || task.column_id === filters.column_id) &&
          (!filters.priority || task.priority === filters.priority) &&
          (!filters.flag_id || task.flag_ids.includes(filters.flag_id)),
      );
      return {
        rows: rows.slice(filters.offset, filters.offset + filters.limite),
        total: rows.length,
      };
    },
    getTask: async (id) => tasks.get(id) ?? null,
    async insertTask(data: TaskWrite) {
      sequence += 1;
      const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
      const row = { ...data, id, created_at: TODAY, updated_at: TODAY, flag_ids: [] };
      tasks.set(id, row);
      return row;
    },
    async updateTask(id, data) {
      const current = tasks.get(id);
      if (!current) return null;
      const next = { ...current, ...data };
      tasks.set(id, next);
      return next;
    },
    deleteTask: async (id) => tasks.delete(id),
    async replaceTaskFlags(taskId, _current, next) {
      const task = tasks.get(taskId);
      if (task) tasks.set(taskId, { ...task, flag_ids: next });
    },
  };

  return { store, tasks };
}

let memory: ReturnType<typeof createMemoryStore>;
let nextId = 0;

async function call(method: string, params?: unknown) {
  nextId += 1;
  return handleRpcMessage(
    { jsonrpc: "2.0", id: nextId, method, params },
    { store: memory.store, today: TODAY },
  );
}

async function callTool(name: string, args: Record<string, unknown>) {
  const outcome = await call("tools/call", { name, arguments: args });
  const result = (outcome.response as { result: Record<string, unknown> }).result;
  return { outcome, result, data: result.structuredContent as Record<string, unknown> };
}

describe("MCP remoto de tarefas", () => {
  beforeEach(() => {
    memory = createMemoryStore();
  });

  it("initialize negocia a versão, entrega o contexto fixo e registra o cliente", async () => {
    const outcome = await call("initialize", {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "claude-code", version: "2.1.0" },
    });
    const result = (outcome.response as { result: Record<string, unknown> }).result;

    assert.equal(outcome.initialized, true);
    assert.equal(result.protocolVersion, "2025-06-18");
    assert.equal(result.instructions, SERVER_INSTRUCTIONS);
    assert.match(SERVER_INSTRUCTIONS, /`ia`/);
    assert.deepEqual(outcome.log?.clientInfo, { name: "claude-code", version: "2.1.0" });
    assert.equal(outcome.log?.agent, "claude");
  });

  it("versão desconhecida recebe a mais nova suportada", async () => {
    const outcome = await call("initialize", { protocolVersion: "1999-01-01" });
    const result = (outcome.response as { result: { protocolVersion: string } }).result;
    assert.equal(result.protocolVersion, "2025-11-25");
  });

  it("notificação não tem resposta nem log", async () => {
    const outcome = await handleRpcMessage(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { store: memory.store, today: TODAY },
    );
    assert.equal(outcome.response, null);
    assert.equal(outcome.log, null);
  });

  it("tools/list exige `ia` em todas as ferramentas e não pede campos com padrão", async () => {
    const outcome = await call("tools/list");
    const { tools } = (
      outcome.response as {
        result: { tools: { name: string; inputSchema: { required?: string[] } }[] };
      }
    ).result;

    assert.ok(tools.length >= 6);
    for (const tool of tools) assert.ok(tool.inputSchema.required?.includes("ia"), tool.name);
    const criar = tools.find((tool) => tool.name === "criar_tarefa");
    assert.deepEqual(criar?.inputSchema.required?.sort(), ["ia", "title"]);
  });

  it("chamada sem `ia` volta como erro de ferramenta, legível para o modelo", async () => {
    const { result, outcome } = await callTool("contexto_tarefas", {});
    assert.equal(result.isError, true);
    assert.equal(outcome.log?.status, "error");
    assert.match(String(outcome.log?.error), /ia/);
  });

  it("registra a IA declarada e o modelo no log", async () => {
    const { outcome, data } = await callTool("contexto_tarefas", {
      ia: "ChatGPT",
      modelo: "gpt-5",
    });
    assert.equal(outcome.log?.agent, "chatgpt");
    assert.equal(outcome.log?.agentModel, "gpt-5");
    assert.equal(outcome.log?.tool, "contexto_tarefas");
    assert.equal(data.hoje, TODAY);
    assert.equal((data.colunas as unknown[]).length, 2);
  });

  it("cria com padrões: primeira coluna, prazo hoje, prioridade medium", async () => {
    const { data } = await callTool("criar_tarefa", { ia: "claude", title: "  Revisar PR  " });
    assert.equal(data.title, "Revisar PR");
    assert.equal(data.column_id, COLUMN_TODO);
    assert.equal(data.column_name, "A fazer");
    assert.equal(data.due_date, TODAY);
    assert.equal(data.priority, "medium");
    assert.equal(data.average_duration_minutes, 30);
  });

  it("recusa coluna, cliente ou flag que não são do usuário", async () => {
    const outro = "99999999-9999-4999-8999-999999999999";
    for (const args of [{ column_id: outro }, { cliente_id: outro }, { flag_ids: [outro] }]) {
      const { result } = await callTool("criar_tarefa", { ia: "claude", title: "x", ...args });
      assert.equal(result.isError, true, JSON.stringify(args));
    }
    assert.equal(memory.tasks.size, 0);
  });

  it("edição parcial não apaga campos omitidos e move de coluna", async () => {
    const { data: created } = await callTool("criar_tarefa", {
      ia: "claude",
      title: "Tarefa",
      description: "detalhes",
      cliente_id: CLIENT,
      flag_ids: [FLAG],
    });
    const { data } = await callTool("editar_tarefa", {
      ia: "claude",
      id: created.id,
      column_id: COLUMN_DONE,
    });

    assert.equal(data.column_id, COLUMN_DONE);
    assert.equal(data.column_name, "Feito");
    assert.equal(data.description, "detalhes");
    assert.equal(data.cliente_id, CLIENT);
    assert.deepEqual(data.flag_ids, [FLAG]);
  });

  it("edição aceita null para tirar cliente e descrição", async () => {
    const { data: created } = await callTool("criar_tarefa", {
      ia: "claude",
      title: "Tarefa",
      description: "detalhes",
      cliente_id: CLIENT,
    });
    const { data } = await callTool("editar_tarefa", {
      ia: "claude",
      id: created.id,
      cliente_id: null,
      description: null,
    });
    assert.equal(data.cliente_id, null);
    assert.equal(data.description, null);
  });

  it("edição sem campos é recusada", async () => {
    const { data: created } = await callTool("criar_tarefa", { ia: "claude", title: "x" });
    const { result } = await callTool("editar_tarefa", { ia: "claude", id: created.id });
    assert.equal(result.isError, true);
  });

  it("exclusão exige confirmado=true", async () => {
    const { data: created } = await callTool("criar_tarefa", { ia: "claude", title: "x" });

    const semConfirmar = await callTool("excluir_tarefa", { ia: "claude", id: created.id });
    assert.equal(semConfirmar.result.isError, true);
    assert.equal(memory.tasks.size, 1);

    const { data } = await callTool("excluir_tarefa", {
      ia: "claude",
      id: created.id,
      confirmado: true,
    });
    assert.equal(data.excluida, true);
    assert.equal(memory.tasks.size, 0);
  });

  it("lista com paginação e próximo offset", async () => {
    for (const title of ["a", "b", "c"]) await callTool("criar_tarefa", { ia: "claude", title });
    const { data } = await callTool("listar_tarefas", { ia: "claude", limite: 2 });
    assert.equal(data.total, 3);
    assert.equal((data.tarefas as unknown[]).length, 2);
    assert.equal(data.proximo_offset, 2);
  });

  it("argumento extra é recusado (schema estrito)", async () => {
    const { result } = await callTool("contexto_tarefas", { ia: "claude", user_id: "outro" });
    assert.equal(result.isError, true);
  });

  it("ferramenta e método desconhecidos viram erro JSON-RPC", async () => {
    const tool = await call("tools/call", { name: "apagar_tudo", arguments: { ia: "x" } });
    assert.equal((tool.response as { error: { code: number } }).error.code, -32602);
    const method = await call("sampling/createMessage");
    assert.equal((method.response as { error: { code: number } }).error.code, -32601);
  });

  it("deduz a IA pelo nome do cliente MCP", () => {
    assert.equal(inferAgentFromClient("claude-ai"), "claude");
    assert.equal(inferAgentFromClient("openai-mcp"), "chatgpt");
    assert.equal(inferAgentFromClient("Visual Studio Code"), "copilot");
    assert.equal(inferAgentFromClient("meu-script"), null);
  });

  it("data de hoje segue o fuso de São Paulo", () => {
    assert.equal(todayIn("America/Sao_Paulo", new Date("2026-11-22T02:30:00Z")), "2026-11-21");
  });
});
