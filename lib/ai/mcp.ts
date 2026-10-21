//* Libraries Imports
import { z } from "zod";

//* Services Imports
import { saveEventoWithTask } from "../../services/evento-task-service.ts";

//* Types Imports
import type * as Api from "../../services/api-service.ts";
import type { EventoInput } from "../../hooks/use-eventos.ts";
import type { LedgerSource } from "../financeiro/ledger.ts";
import type { SaldoResponse } from "../financeiro/balance.ts";
import type { McpTool } from "./types.ts";
import type { ResourceName } from "./resources.ts";

//* Constants Imports
import manifest from "../../public/ai/mcp.json" with { type: "json" };

//* Utils Imports
import {
  RESOURCE_SCHEMAS,
  RESOURCE_NAMES,
  RESOURCE_COLUMNS,
  RESOURCE_DATE_FIELDS,
  REFERENCE_TABLES,
  parseRecordData,
  validateRecordPeriod,
} from "./resources.ts";
import { toLedgerRow } from "../financeiro/ledger.ts";
import { toSaldoBancoRow, computeBankBalance, consolidateBalances } from "../financeiro/balance.ts";
import {
  computeTotals,
  expenseByCategory,
  fixedVersusVariable,
  flowByBank,
  topExpenses,
} from "../financeiro/analytics.ts";

export const MCP_TOOLS = manifest.tools as McpTool[];
export const MCP_MANIFEST = manifest;
type DataApi = Pick<
  typeof Api,
  "get" | "getAll" | "getOne" | "post" | "patch" | "remove" | "upsert" | "rpc"
>;
type JsonObject = Record<string, unknown>;

const resourceSchema = z.enum(RESOURCE_NAMES);
const dataSchema = z.record(z.string(), z.unknown());
const listSchema = z
  .object({
    resource: resourceSchema,
    filters: z
      .record(
        z.string(),
        z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()]),
      )
      .default({}),
    date_from: z.iso.date().optional(),
    date_to: z.iso.date().optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();
const createSchema = z.object({ resource: resourceSchema, data: dataSchema }).strict();
const updateSchema = createSchema.extend({ id: z.uuid() });
const deleteSchema = z.object({ resource: resourceSchema, id: z.uuid() }).strict();
const analyzeSchema = z
  .object({
    date_from: z.iso.date(),
    date_to: z.iso.date(),
    banco_id: z.uuid().optional(),
    cliente_id: z.uuid().optional(),
    categoria_id: z.uuid().optional(),
  })
  .strict();

function assertDateRange(start?: string, end?: string) {
  if (start && end && start > end) throw new Error("A data inicial deve ser anterior à final.");
}

export function createInternalMcp({
  api,
  userId,
  getUserId,
  onChanged = () => {},
}: {
  api: DataApi;
  userId: string;
  getUserId: () => Promise<string>;
  onChanged?: (resource: string) => void;
}) {
  // Repetir um tools/call com o mesmo ID não repete uma alteração.
  const completed = new Map<string | number, { fingerprint: string; result: unknown }>();

  async function assertSession() {
    if (!userId || (await getUserId()) !== userId)
      throw new Error("A conta mudou ou a sessão expirou. Abra uma nova conversa.");
  }

  async function owned(resource: ResourceName, id: string) {
    const row = await api.getOne<JsonObject>(resource, {
      select: RESOURCE_COLUMNS[resource],
      filters: { id, user_id: userId },
    });
    if (!row) throw new Error("Registro não encontrado na sua conta. Consulte os dados novamente.");
    return row;
  }

  async function validateReferences(data: JsonObject) {
    for (const [field, resource] of Object.entries(REFERENCE_TABLES)) {
      if (typeof data[field] === "string") await owned(resource, data[field] as string);
    }
  }

  async function execute(name: string, raw: unknown): Promise<unknown> {
    if (name === "resources_describe") {
      z.object({}).strict().parse(raw);
      return {
        resources: Object.fromEntries(
          RESOURCE_NAMES.map((resource) => [
            resource,
            {
              create: z.toJSONSchema(RESOURCE_SCHEMAS[resource]),
              columns: RESOURCE_COLUMNS[resource].split(","),
              date_field: RESOURCE_DATE_FIELDS[resource] ?? null,
            },
          ]),
        ),
        rules:
          "Não alterar IDs, usuário, chaves ou credenciais. Criar eventos via event_create_with_task. Para editar financeiro: descricao,cliente_id,banco_id,categoria_id,natureza,status; conciliado exige importação. Exclusões não sincronizam automaticamente eventos e tarefas.",
      };
    }

    if (name === "records_list") {
      const args = listSchema.parse(raw);
      assertDateRange(args.date_from, args.date_to);
      const allowed = RESOURCE_COLUMNS[args.resource].split(",");
      for (const field of Object.keys(args.filters)) {
        if (!allowed.includes(field)) throw new Error(`Filtro não permitido: ${field}`);
      }
      const filters: Api.QueryFilters = { ...args.filters, user_id: userId };
      if (args.date_from || args.date_to) {
        const field = RESOURCE_DATE_FIELDS[args.resource];
        if (!field) throw new Error("Este recurso não possui filtro por período.");
        filters[field] = { gte: args.date_from, lte: args.date_to };
        if (args.resource === "eventos") {
          // Limites de dias no fuso local: data_to inclui o dia inteiro.
          filters[field] = {
            gte: args.date_from ? new Date(`${args.date_from}T00:00:00`).toISOString() : undefined,
            lte: args.date_to ? new Date(`${args.date_to}T23:59:59.999`).toISOString() : undefined,
          };
        }
      }
      const rows = await api.get<JsonObject>(args.resource, {
        select: RESOURCE_COLUMNS[args.resource],
        filters,
        order: [{ column: "id", ascending: true }],
        limit: args.limit + 1,
        offset: args.offset,
      });
      const hasMore = rows.length > args.limit;
      return {
        records: rows.slice(0, args.limit),
        has_more: hasMore,
        next_offset: hasMore ? args.offset + args.limit : null,
      };
    }

    if (name === "record_create") {
      const args = createSchema.parse(raw);
      if (args.resource === "eventos")
        throw new Error("Para criar evento e tarefa juntos, use event_create_with_task.");
      const data = parseRecordData(args.resource, args.data);
      validateRecordPeriod(args.resource, data);
      await validateReferences(data);
      if (args.resource === "task_columns") {
        const columns = await api.get<{ position: number }>("task_columns", {
          select: "position",
          filters: { user_id: userId },
          order: [{ column: "position", ascending: false }],
          limit: 1,
        });
        data.key = crypto.randomUUID();
        data.position ??= (columns[0]?.position ?? -1) + 1;
      }
      await assertSession();
      const rows = await api.post<JsonObject>(
        args.resource,
        { ...data, user_id: userId },
        { select: RESOURCE_COLUMNS[args.resource] },
      );
      if (!rows.length) throw new Error("A API não confirmou a criação do registro.");
      onChanged(args.resource);
      return { created: rows[0] };
    }

    if (name === "record_update") {
      const args = updateSchema.parse(raw);
      const data = parseRecordData(args.resource, args.data, true);
      const current = await owned(args.resource, args.id);
      validateRecordPeriod(args.resource, { ...current, ...data });
      await validateReferences(data);
      await assertSession();
      const rows = await api.patch<JsonObject>(
        args.resource,
        data,
        { id: args.id, user_id: userId },
        { select: RESOURCE_COLUMNS[args.resource] },
      );
      if (!rows.length)
        throw new Error("Nenhum registro foi alterado. Confira a sessão e as permissões.");
      onChanged(args.resource);
      return { updated: rows[0] };
    }

    if (name === "record_delete") {
      const args = deleteSchema.parse(raw);
      const current = await owned(args.resource, args.id);
      if (args.resource === "task_columns") {
        const task = await api.getOne("tasks", {
          select: "id",
          filters: { column_id: args.id, user_id: userId },
        });
        if (task) throw new Error("Mova as tarefas antes de excluir esta coluna.");
      }
      await assertSession();
      await api.remove(args.resource, { id: args.id, user_id: userId });
      if (
        await api.getOne(args.resource, { select: "id", filters: { id: args.id, user_id: userId } })
      ) {
        throw new Error("A exclusão não foi confirmada. Confira as permissões do registro.");
      }
      onChanged(args.resource);
      return { deleted: current };
    }

    if (name === "event_create_with_task") {
      const args = z
        .object({ column_id: z.uuid(), data: RESOURCE_SCHEMAS.eventos })
        .strict()
        .parse(raw);
      const data = {
        ...args.data,
        descricao: args.data.descricao ?? "",
        local: args.data.local ?? "",
        cliente_id: args.data.cliente_id ?? null,
      } as EventoInput;
      validateRecordPeriod("eventos", data);
      await validateReferences({ ...data, column_id: args.column_id });
      await assertSession();
      const id = crypto.randomUUID();
      try {
        await saveEventoWithTask(data, args.column_id, userId, id, api);
      } finally {
        onChanged("eventos");
        onChanged("tasks");
      }
      return { evento_id: id, task_id: id, column_id: args.column_id };
    }

    if (name === "financeiro_analyze") {
      const args = analyzeSchema.parse(raw);
      assertDateRange(args.date_from, args.date_to);
      const records = await api.getAll<LedgerSource>("financeiro", {
        select: RESOURCE_COLUMNS.financeiro,
        filters: {
          user_id: userId,
          data: { gte: args.date_from, lte: args.date_to },
          banco_id: args.banco_id,
          cliente_id: args.cliente_id,
          categoria_id: args.categoria_id,
        },
        order: [{ column: "id", ascending: true }],
      });
      const rows = records.map(toLedgerRow);
      return {
        period: { start: args.date_from, end: args.date_to },
        currency: "BRL",
        unit: "centavos",
        count: rows.length,
        totals: computeTotals(rows),
        official: computeTotals(rows.filter((row) => row.status !== "provisorio")),
        provisional: computeTotals(rows.filter((row) => row.status === "provisorio")),
        categories: expenseByCategory(rows),
        banks: flowByBank(rows),
        fixed_variable: fixedVersusVariable(rows),
        top_expenses: topExpenses(rows, 10),
        note: "Resultado do período não é saldo bancário. Transferências/pagamentos de fatura excluídos dos resultados. Consulte nomes por IDs nos recursos correspondentes.",
      };
    }

    if (name === "financeiro_balances") {
      const args = z.object({ date: z.iso.date() }).strict().parse(raw);
      const balances = (await api.rpc<SaldoResponse[]>("financeiro_saldos", { p_ate: args.date }))
        .map(toSaldoBancoRow)
        .map(computeBankBalance);
      const consolidated = consolidateBalances(balances);
      return {
        date: args.date,
        currency: "BRL",
        unit: "centavos",
        balances,
        consolidated: {
          ...consolidated,
          ultimaCoberturaPorBanco: Object.fromEntries(consolidated.ultimaCoberturaPorBanco),
        },
        note: "Sem referência, o saldo é calculado e não confirmado por extrato. Consolidado isCompleto=false indica bancos sem referência. Provisórios anteriores à referência podem estar obsoletos.",
      };
    }

    if (name === "timer_control") {
      const args = z
        .object({ action: z.enum(["status", "start", "stop"]), task_id: z.uuid().optional() })
        .strict()
        .parse(raw);
      const running = await api.getOne<JsonObject>("task_time_entries", {
        select: "id,task_id,started_at,ended_at",
        filters: { user_id: userId, ended_at: null },
      });
      if (args.action === "status") return { running };
      await assertSession();
      if (args.action === "stop") {
        const result = running ? await api.rpc("task_time_finalizar") : null;
        onChanged("task_time_entries");
        return { stopped: result };
      }
      if (!args.task_id) throw new Error("Informe task_id para iniciar o cronômetro.");
      await owned("tasks", args.task_id);
      if (running) throw new Error("Já existe um cronômetro ativo. Pare-o antes de iniciar outro.");
      const result = await api.post(
        "task_time_entries",
        { user_id: userId, task_id: args.task_id },
        { select: "id,task_id,started_at,ended_at" },
      );
      onChanged("task_time_entries");
      return { started: result };
    }

    throw new Error("Ferramenta não encontrada.");
  }

  return async function dispatch(request: unknown): Promise<JsonObject | null> {
    const parsed = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.union([z.string(), z.number()]).optional(),
        method: z.string(),
        params: dataSchema.optional(),
      })
      .strict()
      .safeParse(request);
    if (!parsed.success)
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Requisição JSON-RPC inválida." },
      };
    const { id, method, params = {} } = parsed.data;
    if (method === "notifications/initialized" && id === undefined) return null;
    try {
      await assertSession();
      if (method === "initialize")
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            protocolVersion: manifest.protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: manifest.name, version: manifest.version },
          },
        };
      if (method === "ping") return { jsonrpc: "2.0", id: id ?? null, result: {} };
      if (method === "tools/list")
        return { jsonrpc: "2.0", id: id ?? null, result: { tools: MCP_TOOLS } };
      if (method !== "tools/call")
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          error: { code: -32601, message: "Método não encontrado." },
        };
      const call = z
        .object({ name: z.string(), arguments: dataSchema.default({}) })
        .strict()
        .parse(params);
      if (!MCP_TOOLS.some((tool) => tool.name === call.name))
        throw new Error("Ferramenta não encontrada.");
      const fingerprint = JSON.stringify(call);
      const cached = id === undefined ? undefined : completed.get(id);
      if (cached) {
        if (cached.fingerprint !== fingerprint)
          throw new Error("ID de chamada já usado com outros argumentos.");
        return { jsonrpc: "2.0", id, result: cached.result };
      }
      const value = await execute(call.name, call.arguments);
      const result = { content: [{ type: "text", text: JSON.stringify(value) }], isError: false };
      if (id !== undefined) completed.set(id, { fingerprint, result });
      return { jsonrpc: "2.0", id: id ?? null, result };
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
          : error instanceof Error
            ? error.message
            : "Não foi possível executar a ferramenta.";
      if (method === "tools/call")
        return {
          jsonrpc: "2.0",
          id: id ?? null,
          result: { content: [{ type: "text", text: message }], isError: true },
        };
      return { jsonrpc: "2.0", id: id ?? null, error: { code: -32603, message } };
    }
  };
}
