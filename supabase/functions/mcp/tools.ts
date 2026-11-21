//* Libraries Imports
import { z } from "zod";

//* Types Imports
import type { TaskRow, TaskStore, TaskWrite } from "./store.ts";

export const TIMEZONE = "America/Sao_Paulo";

/** Toda ferramenta exige que a IA diga quem é; isso vai para o log que o usuário vê no painel. */
const identity = {
  ia: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe(
      "Nome da IA que está chamando, em minúsculo: claude, chatgpt, gemini, copilot, deepseek... Obrigatório em toda chamada.",
    ),
  modelo: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("Modelo em uso, se souber (ex.: claude-opus-5-5, gpt-5)."),
};

const id = z.uuid();
const date = z.iso.date();
const priority = z.enum(["low", "medium", "high"]);
const flagIds = z
  .array(id)
  .max(5)
  .refine((ids) => new Set(ids).size === ids.length, "Flag repetida.")
  .describe("IDs das flags (no máximo 5). Substitui as flags atuais da tarefa.");

const taskFields = {
  title: z.string().trim().min(1).max(4000).describe("Título da tarefa."),
  description: z.string().trim().max(12000).nullable().optional().describe("Descrição."),
  priority: priority.describe("Prioridade: low, medium ou high."),
  column_id: id.describe("Coluna do kanban (id vindo de contexto_tarefas)."),
  cliente_id: id.nullable().optional().describe("Cliente vinculado, ou null para nenhum."),
  average_duration_minutes: z
    .number()
    .int()
    .min(1)
    .max(525600)
    .describe("Duração estimada em minutos."),
  due_date: date.describe("Prazo, AAAA-MM-DD."),
  flag_ids: flagIds,
};

const schemas = {
  contexto_tarefas: z.object({ ...identity }).strict(),
  listar_tarefas: z
    .object({
      ...identity,
      column_id: id.optional().describe("Só tarefas desta coluna."),
      cliente_id: z
        .union([id, z.literal("sem-cliente")])
        .optional()
        .describe('Só tarefas deste cliente; "sem-cliente" traz as que não têm cliente.'),
      priority: priority.optional(),
      flag_id: id.optional().describe("Só tarefas com esta flag."),
      busca: z.string().trim().max(200).optional().describe("Trecho do título ou da descrição."),
      prazo_de: date.optional().describe("Prazo a partir de (AAAA-MM-DD)."),
      prazo_ate: date.optional().describe("Prazo até (AAAA-MM-DD)."),
      limite: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).max(100000).default(0),
    })
    .strict(),
  ver_tarefa: z.object({ ...identity, id }).strict(),
  criar_tarefa: z
    .object({
      ...identity,
      ...taskFields,
      priority: taskFields.priority.default("medium"),
      column_id: taskFields.column_id
        .optional()
        .describe("Coluna do kanban. Sem ela, a tarefa entra na primeira coluna."),
      average_duration_minutes: taskFields.average_duration_minutes.default(30),
      due_date: taskFields.due_date.optional().describe("Prazo, AAAA-MM-DD. Sem ele, hoje."),
      flag_ids: flagIds.default([]),
    })
    .strict(),
  editar_tarefa: z
    .object({
      ...identity,
      id,
      title: taskFields.title.optional(),
      description: taskFields.description,
      priority: taskFields.priority.optional(),
      column_id: taskFields.column_id.optional().describe("Mover para esta coluna."),
      cliente_id: taskFields.cliente_id,
      average_duration_minutes: taskFields.average_duration_minutes.optional(),
      due_date: taskFields.due_date.optional(),
      flag_ids: flagIds.optional(),
    })
    .strict(),
  excluir_tarefa: z
    .object({
      ...identity,
      id,
      confirmado: z
        .literal(true)
        .describe("Envie true só depois que o usuário confirmar a exclusão nesta conversa."),
    })
    .strict(),
};

export type ToolName = keyof typeof schemas;
type ToolArgs<Name extends ToolName> = z.output<(typeof schemas)[Name]>;

type ToolDefinition<Name extends ToolName> = {
  title: string;
  description: string;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean };
  run: (store: TaskStore, args: ToolArgs<Name>, today: string) => Promise<unknown>;
};

/** Erro de regra de negócio: a mensagem vai inteira para a IA corrigir a chamada. */
export class ToolInputError extends Error {}

export function todayIn(timezone = TIMEZONE, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

async function assertReferences(
  store: TaskStore,
  refs: { column_id?: string; cliente_id?: string | null; flag_ids?: string[] },
) {
  if (refs.column_id) {
    const columns = await store.listColumns();
    if (!columns.some((column) => column.id === refs.column_id))
      throw new ToolInputError("column_id não existe. Consulte contexto_tarefas.");
  }
  if (refs.cliente_id) {
    const clients = await store.listClients();
    if (!clients.some((client) => client.id === refs.cliente_id))
      throw new ToolInputError("cliente_id não existe. Consulte contexto_tarefas.");
  }
  if (refs.flag_ids?.length) {
    const known = new Set((await store.listFlags()).map((flag) => flag.id));
    const missing = refs.flag_ids.filter((flagId) => !known.has(flagId));
    if (missing.length)
      throw new ToolInputError(
        `Flags inexistentes: ${missing.join(", ")}. Consulte contexto_tarefas.`,
      );
  }
}

function pickTaskWrite(args: Partial<TaskWrite> & Record<string, unknown>, provided: object) {
  const keys: (keyof TaskWrite)[] = [
    "title",
    "description",
    "priority",
    "column_id",
    "cliente_id",
    "average_duration_minutes",
    "due_date",
  ];
  // Só o que a IA mandou de fato: um campo omitido não pode apagar o valor atual.
  return Object.fromEntries(
    keys.filter((key) => Object.hasOwn(provided, key)).map((key) => [key, args[key] ?? null]),
  ) as Partial<TaskWrite>;
}

function withColumnName(task: TaskRow, columns: { id: string; name: string }[]) {
  return { ...task, column_name: columns.find((column) => column.id === task.column_id)?.name };
}

const definitions: { [Name in ToolName]: ToolDefinition<Name> } = {
  contexto_tarefas: {
    title: "Contexto do kanban",
    description:
      "Data de hoje, colunas do kanban (na ordem), flags e clientes com seus ids. Chame antes de criar, mover ou filtrar tarefas.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async run(store, _args, today) {
      const [columns, flags, clients] = await Promise.all([
        store.listColumns(),
        store.listFlags(),
        store.listClients(),
      ]);
      return {
        hoje: today,
        fuso: TIMEZONE,
        prioridades: ["low", "medium", "high"],
        colunas: columns,
        flags,
        clientes: clients,
        observacoes:
          "stage 'pending' marca a coluna de pendência e 'done' a de conclusão; colunas depois da de conclusão também contam como concluídas.",
      };
    },
  },

  listar_tarefas: {
    title: "Listar tarefas",
    description:
      "Lista tarefas com filtros opcionais (coluna, cliente, prioridade, flag, busca por texto, intervalo de prazo). Mais recentes primeiro, paginado por limite/offset.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async run(store, args) {
      const [{ rows, total }, columns] = await Promise.all([
        store.listTasks({
          column_id: args.column_id,
          cliente_id: args.cliente_id === "sem-cliente" ? null : args.cliente_id,
          priority: args.priority,
          flag_id: args.flag_id,
          busca: args.busca,
          prazo_de: args.prazo_de,
          prazo_ate: args.prazo_ate,
          limite: args.limite,
          offset: args.offset,
        }),
        store.listColumns(),
      ]);
      const nextOffset = args.offset + rows.length;
      return {
        total,
        tarefas: rows.map((task) => withColumnName(task, columns)),
        proximo_offset: nextOffset < total ? nextOffset : null,
      };
    },
  },

  ver_tarefa: {
    title: "Ver tarefa",
    description: "Detalhes de uma tarefa pelo id, com o nome da coluna.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async run(store, args) {
      const [task, columns] = await Promise.all([store.getTask(args.id), store.listColumns()]);
      if (!task) throw new ToolInputError("Tarefa não encontrada.");
      return withColumnName(task, columns);
    },
  },

  criar_tarefa: {
    title: "Criar tarefa",
    description:
      "Cria uma tarefa. Sem column_id entra na primeira coluna; sem due_date, prazo hoje; prioridade padrão medium e duração padrão 30 min.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run(store, args, today) {
      const columns = await store.listColumns();
      const columnId = args.column_id ?? columns[0]?.id;
      if (!columnId) throw new ToolInputError("O kanban não tem colunas. Crie uma no painel.");
      await assertReferences(store, {
        column_id: columnId,
        cliente_id: args.cliente_id,
        flag_ids: args.flag_ids,
      });

      const created = await store.insertTask({
        title: args.title,
        description: args.description ?? null,
        priority: args.priority,
        column_id: columnId,
        cliente_id: args.cliente_id ?? null,
        average_duration_minutes: args.average_duration_minutes,
        due_date: args.due_date ?? today,
      });
      if (args.flag_ids.length) await store.replaceTaskFlags(created.id, [], args.flag_ids);
      return withColumnName({ ...created, flag_ids: args.flag_ids }, columns);
    },
  },

  editar_tarefa: {
    title: "Editar ou mover tarefa",
    description:
      "Altera campos de uma tarefa; envie só o que muda. Para mover de coluna, envie column_id. flag_ids substitui todas as flags.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run(store, args) {
      const changes = pickTaskWrite(args, args);
      if (!Object.keys(changes).length && !args.flag_ids)
        throw new ToolInputError("Informe ao menos um campo para alterar.");

      const current = await store.getTask(args.id);
      if (!current) throw new ToolInputError("Tarefa não encontrada.");
      await assertReferences(store, {
        column_id: changes.column_id,
        cliente_id: changes.cliente_id,
        flag_ids: args.flag_ids,
      });

      const updated = Object.keys(changes).length
        ? await store.updateTask(args.id, changes)
        : current;
      if (!updated) throw new ToolInputError("Tarefa não encontrada.");
      if (args.flag_ids) await store.replaceTaskFlags(args.id, current.flag_ids, args.flag_ids);
      return withColumnName(
        { ...updated, flag_ids: args.flag_ids ?? current.flag_ids },
        await store.listColumns(),
      );
    },
  },

  excluir_tarefa: {
    title: "Excluir tarefa",
    description:
      "Exclui uma tarefa de forma definitiva, com flags e tempos registrados. Peça confirmação ao usuário antes e envie confirmado=true.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async run(store, args) {
      const task = await store.getTask(args.id);
      if (!task) throw new ToolInputError("Tarefa não encontrada.");
      await store.deleteTask(args.id);
      return { excluida: true, id: task.id, title: task.title };
    },
  },
};

export const TOOL_NAMES = Object.keys(definitions) as ToolName[];

export function isToolName(name: unknown): name is ToolName {
  return typeof name === "string" && Object.hasOwn(definitions, name);
}

/** Catálogo no formato de `tools/list`, com o JSON Schema gerado do mesmo schema que valida. */
export function listTools() {
  return TOOL_NAMES.map((name) => {
    const inputSchema: Record<string, unknown> = z.toJSONSchema(schemas[name], { io: "input" });
    delete inputSchema.$schema;
    return {
      name,
      title: definitions[name].title,
      description: definitions[name].description,
      inputSchema,
      annotations: { title: definitions[name].title, ...definitions[name].annotations },
    };
  });
}

function formatZodError(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "argumentos"}: ${issue.message}`)
    .join("; ");
}

export type ToolOutcome = { ok: true; data: unknown } | { ok: false; error: string };

export async function runTool(
  name: ToolName,
  rawArgs: unknown,
  store: TaskStore,
  today: string,
): Promise<ToolOutcome> {
  const parsed = schemas[name].safeParse(rawArgs ?? {});
  if (!parsed.success)
    return { ok: false, error: `Argumentos inválidos: ${formatZodError(parsed.error)}` };

  try {
    const definition = definitions[name] as ToolDefinition<ToolName>;
    return {
      ok: true,
      data: await definition.run(store, parsed.data as ToolArgs<ToolName>, today),
    };
  } catch (error) {
    if (error instanceof ToolInputError) return { ok: false, error: error.message };
    // Erro do banco: a mensagem do Postgres (ex.: limite de 5 flags) ajuda a IA a corrigir.
    if (error && typeof error === "object" && "message" in error)
      return { ok: false, error: String(error.message) };
    return { ok: false, error: "Falha inesperada ao executar a ferramenta." };
  }
}
