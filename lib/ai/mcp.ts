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

const BULK_CHUNK = 100;
const bulkUpdateSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(200),
    descricao: z.string().nullable().optional(),
    cliente_id: z.uuid().nullable().optional(),
    banco_id: z.uuid().nullable().optional(),
    categoria_id: z.uuid().nullable().optional(),
    natureza: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

const MAX_TASK_FLAGS = 5;
const taskFlagsSchema = z
  .object({
    task_ids: z.array(z.uuid()).min(1).max(200),
    add_flag_ids: z.array(z.uuid()).max(MAX_TASK_FLAGS).default([]),
    remove_flag_ids: z.array(z.uuid()).max(50).default([]),
  })
  .strict();

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

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
          "Não alterar IDs, usuário, chaves ou credenciais. Criar eventos via event_create_with_task. Para editar financeiro: descricao,cliente_id,banco_id,categoria_id,natureza,status; conciliado exige importação. Exclusões não sincronizam automaticamente eventos e tarefas. Flags de tarefas são cadastradas em task_flags e aplicadas/removidas com task_flags_bulk_update (máximo 5 por tarefa); records_list de tasks traz flag_ids.",
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
      const records = rows.slice(0, args.limit);
      if (args.resource === "tasks" && records.length) {
        const links = await api.getAll<{ task_id: string; flag_id: string }>("task_flag_links", {
          select: "task_id,flag_id",
          filters: { task_id: records.map((row) => String(row.id)), user_id: userId },
        });
        for (const row of records)
          row.flag_ids = links
            .filter((link) => link.task_id === row.id)
            .map((link) => link.flag_id);
      }
      return {
        records,
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

    if (name === "financeiro_bulk_update") {
      const { ids: rawIds, ...changes } = bulkUpdateSchema.parse(raw);
      const ids = [...new Set(rawIds)];
      // Mesma validação da edição individual; só chaves enviadas entram na alteração.
      const data = parseRecordData("financeiro", changes, true);
      await validateReferences(data);

      // Tudo é conferido antes da primeira escrita: um ID alheio ou inexistente cancela a chamada.
      let found = 0;
      for (const part of chunks(ids, BULK_CHUNK)) {
        const rows = await api.getAll<JsonObject>("financeiro", {
          select: "id",
          filters: { id: part, user_id: userId },
        });
        found += rows.length;
      }
      if (found !== ids.length)
        throw new Error(
          `${ids.length - found} dos ${ids.length} lançamentos não foram encontrados na sua conta. Nada foi alterado; consulte os dados novamente.`,
        );

      await assertSession();
      let updated = 0;
      try {
        for (const part of chunks(ids, BULK_CHUNK)) {
          const rows = await api.patch<JsonObject>(
            "financeiro",
            data,
            {
              id: part,
              user_id: userId,
            },
            { select: "id" },
          );
          updated += rows.length;
        }
      } finally {
        if (updated > 0) onChanged("financeiro");
      }
      if (updated !== ids.length)
        throw new Error(
          `Apenas ${updated} de ${ids.length} lançamentos foram alterados. Consulte os dados antes de repetir.`,
        );
      return { updated: updated, changes: data };
    }

    if (name === "task_flags_bulk_update") {
      const args = taskFlagsSchema.parse(raw);
      const taskIds = [...new Set(args.task_ids)];
      const addIds = [...new Set(args.add_flag_ids)];
      const removeIds = [...new Set(args.remove_flag_ids)].filter((id) => !addIds.includes(id));
      if (!addIds.length && !removeIds.length)
        throw new Error("Informe ao menos uma flag para adicionar ou remover.");

      // Tarefas, flags e o limite por tarefa são conferidos antes da primeira escrita.
      const flagIds = [...addIds, ...removeIds];
      const flags = await api.getAll<JsonObject>("task_flags", {
        select: RESOURCE_COLUMNS.task_flags,
        filters: { id: flagIds, user_id: userId },
      });
      if (flags.length !== flagIds.length)
        throw new Error("Flag não encontrada na sua conta. Consulte task_flags novamente.");
      let found = 0;
      const links: { task_id: string; flag_id: string }[] = [];
      for (const part of chunks(taskIds, BULK_CHUNK)) {
        found += (
          await api.getAll<JsonObject>("tasks", {
            select: "id",
            filters: { id: part, user_id: userId },
          })
        ).length;
        links.push(
          ...(await api.getAll<{ task_id: string; flag_id: string }>("task_flag_links", {
            select: "task_id,flag_id",
            filters: { task_id: part, user_id: userId },
          })),
        );
      }
      if (found !== taskIds.length)
        throw new Error(
          `${taskIds.length - found} das ${taskIds.length} tarefas não foram encontradas na sua conta. Nada foi alterado; consulte os dados novamente.`,
        );

      const inserts: { task_id: string; flag_id: string; user_id: string }[] = [];
      const overLimit: string[] = [];
      for (const taskId of taskIds) {
        const current = links.filter((link) => link.task_id === taskId).map((link) => link.flag_id);
        const kept = current.filter((id) => !removeIds.includes(id));
        const added = addIds.filter((id) => !kept.includes(id));
        if (kept.length + added.length > MAX_TASK_FLAGS) overLimit.push(taskId);
        inserts.push(
          ...added.map((flagId) => ({ task_id: taskId, flag_id: flagId, user_id: userId })),
        );
      }
      if (overLimit.length)
        throw new Error(
          `Uma tarefa pode ter no máximo ${MAX_TASK_FLAGS} flags. Excederiam o limite: ${overLimit.join(", ")}. Nada foi alterado.`,
        );

      await assertSession();
      let removed = 0;
      let added = 0;
      try {
        // Remove antes de inserir, por causa do limite de flags por tarefa no banco.
        if (removeIds.length) {
          const removing = links.filter((link) => removeIds.includes(link.flag_id));
          for (const part of chunks(taskIds, BULK_CHUNK))
            await api.remove("task_flag_links", {
              task_id: part,
              flag_id: removeIds,
              user_id: userId,
            });
          removed = removing.length;
        }
        for (const part of chunks(inserts, BULK_CHUNK)) {
          await api.post("task_flag_links", part, { select: "task_id" });
          added += part.length;
        }
      } finally {
        if (removed > 0 || added > 0) onChanged("tasks");
      }
      return { tasks: taskIds.length, links_added: added, links_removed: removed, flags };
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
      if (args.resource === "task_flags") onChanged("tasks");
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
