//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Types Imports
import type { QueryOptions, QueryFilters } from "../services/api-service.ts";
import type { LedgerSource } from "../lib/financeiro/ledger.ts";

//* Utils Imports
import { createInternalMcp, MCP_TOOLS } from "../lib/ai/mcp.ts";
import { parseRecordData } from "../lib/ai/resources.ts";

type Row = Record<string, unknown>;
type DataApi = Parameters<typeof createInternalMcp>[0]["api"];
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const COLUMN = "44444444-4444-4444-8444-444444444444";

function database(initial: Record<string, Row[]> = {}) {
  const rows = structuredClone(initial);
  const calls: { operation: string; table: string; options?: QueryOptions; body?: object }[] = [];
  const rpcResults: Record<string, unknown> = {};
  function matches(row: Row, filters: QueryFilters = {}) {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined) return true;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return (
          (!value.gte || String(row[key]) >= String(value.gte)) &&
          (!value.lte || String(row[key]) <= String(value.lte))
        );
      }
      return row[key] === value;
    });
  }
  function select(row: Row, columns?: string) {
    if (!columns || columns === "*") return { ...row };
    return Object.fromEntries(columns.split(",").map((key) => [key.trim(), row[key.trim()]]));
  }
  const api: DataApi = {
    async get<T>(table: string, options: QueryOptions = {}) {
      calls.push({ operation: "get", table, options });
      return (rows[table] ?? [])
        .filter((row) => matches(row, options.filters))
        .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? Infinity))
        .map((row) => select(row, options.select)) as T[];
    },
    async getAll<T>(table: string, options: QueryOptions = {}) {
      calls.push({ operation: "getAll", table, options });
      return (rows[table] ?? [])
        .filter((row) => matches(row, options.filters))
        .map((row) => select(row, options.select)) as T[];
    },
    async getOne<T>(table: string, options: QueryOptions = {}) {
      calls.push({ operation: "getOne", table, options });
      const row = (rows[table] ?? []).find((row) => matches(row, options.filters));
      return row ? (select(row, options.select) as T) : null;
    },
    async post<T>(table: string, body: object | object[], options: { select?: string } = {}) {
      calls.push({ operation: "post", table, body });
      const added = (Array.isArray(body) ? body : [body]).map((item) => ({
        id: crypto.randomUUID(),
        ...item,
      }));
      rows[table] = [...(rows[table] ?? []), ...added];
      return added.map((row) => select(row, options.select)) as T[];
    },
    async upsert<T>(table: string, body: object[]) {
      calls.push({ operation: "upsert", table, body });
      for (const item of body as Row[]) {
        rows[table] ??= [];
        const current = rows[table].find((row) => row.id === item.id);
        if (current) Object.assign(current, item);
        else rows[table].push({ ...item });
      }
      return body as T[];
    },
    async patch<T>(
      table: string,
      body: object,
      filters: QueryFilters,
      options: { select?: string } = {},
    ) {
      calls.push({ operation: "patch", table, body, options: { filters } });
      const updated = (rows[table] ?? []).filter((row) => matches(row, filters));
      updated.forEach((row) => Object.assign(row, body));
      return updated.map((row) => select(row, options.select)) as T[];
    },
    async remove(table: string, filters: QueryFilters) {
      calls.push({ operation: "remove", table, options: { filters } });
      rows[table] = (rows[table] ?? []).filter((row) => !matches(row, filters));
    },
    async rpc<T>(table: string, body?: object) {
      calls.push({ operation: "rpc", table, body });
      return rpcResults[table] as T;
    },
  };
  let authenticated = USER;
  const changed: string[] = [];
  const dispatch = createInternalMcp({
    api,
    userId: USER,
    getUserId: async () => authenticated,
    onChanged: (resource) => changed.push(resource),
  });
  async function call(name: string, args: object = {}, id: string = crypto.randomUUID()) {
    const response = await dispatch({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    });
    const result = response?.result as { isError: boolean; content: { text: string }[] };
    return {
      ...result,
      value: result.isError ? null : (JSON.parse(result.content[0].text) as Row),
      text: result.content[0].text,
    };
  }
  return {
    rows,
    calls,
    api,
    dispatch,
    call,
    rpcResults,
    changed,
    setUser: (user: string) => {
      authenticated = user;
    },
  };
}

describe("MCP interno", () => {
  it("negocia JSON-RPC e anuncia o mesmo catálogo usado pelos modelos", async () => {
    const db = database();
    const initialized = await db.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    assert.equal((initialized?.result as Row).protocolVersion, "2025-11-25");
    const tools = await db.dispatch({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.deepEqual((tools?.result as Row).tools, MCP_TOOLS);
    assert.equal(await db.dispatch({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
    assert.equal(
      ((await db.dispatch({ jsonrpc: "2.0", id: 3, method: "execute_sql" }))?.error as Row).code,
      -32601,
    );
    assert.equal(db.calls.length, 0);
  });

  it("expõe os schemas sem credenciais ou campos de identidade graváveis", async () => {
    const db = database();
    const result = await db.call("resources_describe");
    assert.equal(result.isError, false);
    const resources = result.value?.resources as Record<string, { create: { properties: object } }>;
    assert.equal(Object.keys(resources).length, 10);
    for (const resource of Object.values(resources))
      assert.ok(!Object.hasOwn(resource.create.properties, "user_id"));
  });

  it("rejeita sessão de outra conta antes de acessar o banco", async () => {
    const db = database();
    db.setUser(OTHER);
    assert.equal((await db.call("records_list", { resource: "tasks" })).isError, true);
    assert.equal(db.calls.length, 0);
  });

  it("consulta apenas registros da conta, pagina e informa quando há mais", async () => {
    const db = database({
      tasks: [
        { id: ID, user_id: USER, title: "Minha" },
        { id: COLUMN, user_id: OTHER, title: "Outra conta" },
        { id: USER, user_id: USER, title: "Minha segunda" },
      ],
    });
    const result = await db.call("records_list", { resource: "tasks", limit: 1 });
    assert.equal(result.value?.has_more, true);
    assert.equal(result.value?.next_offset, 1);
    assert.equal((result.value?.records as Row[])[0].title, "Minha");
    assert.deepEqual(db.calls[0].options?.filters, { user_id: USER });
    assert.equal(
      (await db.call("records_list", { resource: "tasks", filters: { user_id: OTHER } })).isError,
      true,
    );
    assert.equal((await db.call("records_list", { resource: "push_subscriptions" })).isError, true);
  });

  it("protege identidade, campos imutáveis e dados monetários", async () => {
    const db = database();
    for (const data of [{ id: ID }, { user_id: OTHER }, { value: "hack" }]) {
      assert.equal(
        (await db.call("record_update", { resource: "tasks", id: ID, data })).isError,
        true,
      );
    }
    assert.equal(
      (await db.call("record_update", { resource: "financeiro", id: ID, data: { valor: 1 } }))
        .isError,
      true,
    );
    assert.equal(
      (
        await db.call("record_create", {
          resource: "financeiro",
          data: { data: "2026-10-21", tipo: "gasto", valor: 1.234 },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await db.call("record_create", {
          resource: "financeiro",
          data: { data: "2026-10-21", tipo: "gasto", valor: 1, status: "conciliado" },
        })
      ).isError,
      true,
    );
    assert.equal(db.calls.length, 0);
  });

  it("não aplica defaults ao atualizar só um campo", () => {
    assert.deepEqual(parseRecordData("tasks", { title: "Novo título" }, true), {
      title: "Novo título",
    });
    assert.deepEqual(parseRecordData("clients", { name: "Novo nome" }, true), {
      name: "Novo nome",
    });
  });

  it("valida a posse das referências antes de mover tarefas", async () => {
    const db = database({
      tasks: [{ id: ID, user_id: USER, title: "Task" }],
      task_columns: [{ id: COLUMN, user_id: OTHER, name: "Outra conta" }],
    });
    assert.equal(
      (await db.call("record_update", { resource: "tasks", id: ID, data: { column_id: COLUMN } }))
        .isError,
      true,
    );
    assert.equal(
      db.calls.some((call) => call.operation === "patch"),
      false,
    );
  });

  it("move tarefa e não repete a escrita de uma chamada concluída", async () => {
    const db = database({
      tasks: [{ id: ID, user_id: USER, title: "Task", priority: "high" }],
      task_columns: [{ id: COLUMN, user_id: USER, name: "Fazendo" }],
    });
    const args = { resource: "tasks", id: ID, data: { column_id: COLUMN } };
    assert.equal((await db.call("record_update", args, "once")).isError, false);
    assert.equal((await db.call("record_update", args, "once")).isError, false);
    assert.equal(db.rows.tasks[0].column_id, COLUMN);
    assert.equal(db.rows.tasks[0].priority, "high");
    assert.equal(db.calls.filter((call) => call.operation === "patch").length, 1);
    assert.deepEqual(db.changed, ["tasks"]);
    assert.equal(
      (await db.call("record_update", { ...args, data: { title: "Mudou" } }, "once")).isError,
      true,
    );
  });

  it("não altera registros de outra conta nem apaga coluna com tarefas", async () => {
    const db = database({
      tasks: [
        { id: ID, user_id: OTHER },
        { id: USER, user_id: USER, column_id: COLUMN },
      ],
      task_columns: [{ id: COLUMN, user_id: USER, name: "Fazendo" }],
    });
    assert.equal((await db.call("record_delete", { resource: "tasks", id: ID })).isError, true);
    assert.equal(
      (await db.call("record_delete", { resource: "task_columns", id: COLUMN })).isError,
      true,
    );
    assert.equal(
      db.calls.some((call) => call.operation === "remove"),
      false,
    );
  });

  it("confirma exclusão e não anuncia sucesso se DELETE não removeu o registro", async () => {
    const db = database({ tasks: [{ id: ID, user_id: USER, title: "Task" }] });
    db.api.remove = async () => {};
    const result = await db.call("record_delete", { resource: "tasks", id: ID });
    assert.equal(result.isError, true);
    assert.match(result.text, /exclusão não foi confirmada/);
    assert.deepEqual(db.changed, []);
  });

  it("valida o período completo ao editar só a data de fim", async () => {
    const db = database({
      eventos: [
        {
          id: ID,
          user_id: USER,
          data_inicio: "2026-10-21T12:00:00Z",
          data_fim: "2026-10-21T13:00:00Z",
        },
      ],
    });
    assert.equal(
      (
        await db.call("record_update", {
          resource: "eventos",
          id: ID,
          data: { data_fim: "2026-10-20T12:00:00Z" },
        })
      ).isError,
      true,
    );
    assert.equal(
      db.calls.some((call) => call.operation === "patch"),
      false,
    );
  });

  it("cria evento com task na coluna escolhida, sem permitir pular a tarefa", async () => {
    const db = database({ task_columns: [{ id: COLUMN, user_id: USER, name: "A fazer" }] });
    const data = {
      titulo: "Reunião",
      data_inicio: "2026-10-21T12:00:00Z",
      data_fim: "2026-10-21T13:00:00Z",
    };
    assert.equal((await db.call("record_create", { resource: "eventos", data })).isError, true);
    const result = await db.call("event_create_with_task", { column_id: COLUMN, data });
    assert.equal(result.isError, false);
    assert.equal(db.rows.tasks[0].column_id, COLUMN);
    assert.equal(db.rows.tasks[0].user_id, USER);
    assert.equal(db.rows.tasks[0].title, "Reunião");
    assert.equal(db.rows.eventos[0].id, db.rows.tasks[0].id);
    assert.deepEqual(db.changed, ["eventos", "tasks"]);
  });

  it("analisa o período inteiro com as regras do dashboard, sem truncar em uma página", async () => {
    const base: LedgerSource = {
      id: ID,
      data: "2026-10-21",
      tipo: "gasto",
      valor: "10.10",
      status: "confirmado",
      natureza: "normal",
      banco_id: null,
      categoria_id: null,
      cliente_id: null,
      fitid: "extrato",
      descricao: "Despesa",
      gasto_fixo_id: null,
    };
    const records: Row[] = Array.from({ length: 1001 }, (_, index) => ({
      ...base,
      id: String(index),
      user_id: USER,
    }));
    records.push({
      ...base,
      id: "transfer",
      valor: 5000,
      natureza: "transferencia",
      user_id: USER,
    });
    records.push({
      ...base,
      id: "refund",
      valor: 10,
      tipo: "ganho",
      natureza: "estorno",
      user_id: USER,
    });
    records.push({ ...base, id: "other", valor: 99999, user_id: OTHER });
    const db = database({ financeiro: records });
    const result = await db.call("financeiro_analyze", {
      date_from: "2026-10-01",
      date_to: "2026-10-31",
    });
    assert.equal(result.isError, false);
    assert.equal(result.value?.count, 1003);
    assert.equal(result.value?.unit, "centavos");
    assert.deepEqual(result.value?.totals, {
      receitas: 0,
      despesas: 1010010,
      resultado: -1010010,
      internosCents: 500000,
      internosQtd: 1,
    });
    assert.equal(db.calls[0].operation, "getAll");
    assert.equal(
      (await db.call("financeiro_analyze", { date_from: "2026-10-31", date_to: "2026-10-01" }))
        .isError,
      true,
    );
  });

  it("calcula saldos confirmados/estimados e sinaliza bancos sem referência", async () => {
    const db = database();
    const base = {
      banco_id: ID,
      ref_data: "2026-10-01",
      ref_saldo: "1000.00",
      mov_oficial: "-200.00",
      mov_total: "-250.50",
      total: "9999.99",
      provisorios_qtd: 1,
      provisorios_valor: "50.50",
      provisorios_obsoletos_qtd: 0,
      ultima_cobertura: "2026-10-01",
    };
    db.rpcResults.financeiro_saldos = [
      base,
      { ...base, banco_id: COLUMN, ref_data: null, ref_saldo: null, total: "25.00" },
    ];
    const result = await db.call("financeiro_balances", { date: "2026-10-21" });
    const balances = result.value?.balances as Row[];
    assert.equal(balances[0].confirmado, 80000);
    assert.equal(balances[0].estimado, 74950);
    assert.equal(balances[1].kind, "calculado");
    assert.equal(balances[1].confirmado, null);
    assert.equal((result.value?.consolidated as Row).isCompleto, false);
    assert.equal(result.value?.unit, "centavos");
  });

  it("não permite iniciar cronômetro para tarefa de outra conta", async () => {
    const db = database({ tasks: [{ id: ID, user_id: OTHER }] });
    assert.equal((await db.call("timer_control", { action: "start", task_id: ID })).isError, true);
    assert.equal(
      db.calls.some((call) => call.operation === "post"),
      false,
    );
  });
});
