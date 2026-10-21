//* Libraries Imports
import { z } from "zod";

const id = z.uuid();
const optionalId = id.nullable().optional();
const text = z.string().trim().min(1).max(4000);
const description = z.string().trim().max(12000).nullable().optional();
const date = z.iso.date();
const money = z
  .number()
  .finite()
  .positive()
  .max(999999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    "Use no máximo duas casas decimais.",
  );

export const RESOURCE_SCHEMAS = {
  tasks: z
    .object({
      title: text,
      description,
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      column_id: id,
      cliente_id: optionalId,
      average_duration_minutes: z.number().int().min(1).max(525600).default(30),
      due_date: date,
    })
    .strict(),
  task_columns: z
    .object({
      name: text,
      color: z.string().max(100).nullable().optional(),
      position: z.number().int().min(0).max(10000).optional(),
    })
    .strict(),
  clients: z
    .object({
      name: text,
      contact: z.string().trim().max(4000).default(""),
      status: z.enum(["active", "inactive"]).default("active"),
    })
    .strict(),
  eventos: z
    .object({
      titulo: text,
      descricao: description,
      local: z.string().trim().max(4000).nullable().optional(),
      data_inicio: z.iso.datetime({ offset: true }),
      data_fim: z.iso.datetime({ offset: true }),
      dia_inteiro: z.boolean().default(false),
      cliente_id: optionalId,
    })
    .strict(),
  financeiro: z
    .object({
      data: date,
      tipo: z.enum(["gasto", "ganho"]),
      valor: money,
      descricao: description,
      cliente_id: optionalId,
      banco_id: optionalId,
      categoria_id: optionalId,
      natureza: z
        .enum(["normal", "transferencia", "pagamento_fatura", "estorno"])
        .default("normal"),
      status: z.enum(["provisorio", "confirmado", "conciliado"]).default("provisorio"),
    })
    .strict(),
  gastos_fixos: z
    .object({
      descricao: text,
      valor: money,
      dia_cobranca: z.number().int().min(1).max(31),
      data_inicio: date,
      data_fim: date.nullable().optional(),
      ativo: z.boolean().default(true),
    })
    .strict(),
  bancos: z.object({ nome: text }).strict(),
  financeiro_categorias: z
    .object({ nome: text, termos: z.array(text).max(100).default([]) })
    .strict(),
  financeiro_grupos: z
    .object({ nome: text.nullable().optional(), termos: z.array(text).min(1).max(100) })
    .strict(),
  financeiro_saldos_referencia: z
    .object({
      banco_id: id,
      data: date,
      saldo: z.number().finite().min(-999999999.99).max(999999999.99),
      origem: z.literal("manual").default("manual"),
    })
    .strict(),
};

export type ResourceName = keyof typeof RESOURCE_SCHEMAS;
export const RESOURCE_NAMES = Object.keys(RESOURCE_SCHEMAS) as [ResourceName, ...ResourceName[]];

export const RESOURCE_COLUMNS: Record<ResourceName, string> = {
  tasks:
    "id,title,description,priority,column_id,cliente_id,average_duration_minutes,due_date,created_at,updated_at",
  task_columns: "id,key,name,color,position",
  clients: "id,name,contact,status",
  eventos: "id,titulo,descricao,local,data_inicio,data_fim,dia_inteiro,cliente_id",
  financeiro:
    "id,data,tipo,valor,descricao,cliente_id,gasto_fixo_id,banco_id,fitid,status,natureza,categoria_id,lote_id,conciliado_em,created_at",
  gastos_fixos: "id,descricao,valor,dia_cobranca,data_inicio,data_fim,ativo",
  bancos: "id,nome",
  financeiro_categorias: "id,nome,termos",
  financeiro_grupos: "id,nome,termos",
  financeiro_saldos_referencia: "id,banco_id,data,saldo,origem",
};

export const RESOURCE_DATE_FIELDS: Partial<Record<ResourceName, string>> = {
  tasks: "due_date",
  eventos: "data_inicio",
  financeiro: "data",
  gastos_fixos: "data_inicio",
  financeiro_saldos_referencia: "data",
};

const financeEdit = RESOURCE_SCHEMAS.financeiro
  .pick({
    descricao: true,
    cliente_id: true,
    banco_id: true,
    categoria_id: true,
    natureza: true,
    status: true,
  })
  .partial();

export function parseRecordData(
  resource: ResourceName,
  data: unknown,
  updating = false,
): Record<string, unknown> {
  const schema = updating
    ? resource === "financeiro"
      ? financeEdit
      : RESOURCE_SCHEMAS[resource].partial()
    : RESOURCE_SCHEMAS[resource];
  const parsed = schema.parse(data) as Record<string, unknown>;
  // Defaults de campos omitidos não podem sobrescrever dados em uma edição parcial.
  const result = updating
    ? Object.fromEntries(
        Object.entries(parsed).filter(([key]) => Object.hasOwn(data as object, key)),
      )
    : parsed;
  if (!Object.keys(result).length) throw new Error("Informe ao menos um campo para alterar.");
  if (resource === "financeiro" && result.status === "conciliado") {
    throw new Error(
      "Conciliação exige o fluxo de importação de extrato do Financeiro. Use provisorio ou confirmado.",
    );
  }
  return result;
}

export function validateRecordPeriod(resource: ResourceName, data: Record<string, unknown>) {
  if (
    resource === "eventos" &&
    new Date(String(data.data_fim)) < new Date(String(data.data_inicio))
  ) {
    throw new Error("O fim do evento não pode ser anterior ao início.");
  }
  if (
    resource === "gastos_fixos" &&
    data.data_fim &&
    String(data.data_fim) < String(data.data_inicio)
  ) {
    throw new Error("O fim da recorrência não pode ser anterior ao início.");
  }
  if (
    resource === "financeiro_grupos" &&
    Array.isArray(data.termos) &&
    data.termos.length > 1 &&
    !data.nome
  ) {
    throw new Error("Informe o nome do grupo com vários termos.");
  }
}

export const REFERENCE_TABLES: Record<string, ResourceName> = {
  column_id: "task_columns",
  cliente_id: "clients",
  banco_id: "bancos",
  categoria_id: "financeiro_categorias",
};
