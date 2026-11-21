//* Types Imports
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskPriority = "low" | "medium" | "high";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  column_id: string;
  cliente_id: string | null;
  average_duration_minutes: number;
  due_date: string;
  created_at: string;
  updated_at: string;
  flag_ids: string[];
};

export type TaskWrite = Pick<
  TaskRow,
  | "title"
  | "description"
  | "priority"
  | "column_id"
  | "cliente_id"
  | "average_duration_minutes"
  | "due_date"
>;

export type ColumnRow = {
  id: string;
  name: string;
  stage: "pending" | "done" | null;
  position: number;
};
export type FlagRow = { id: string; name: string; color: string };
export type ClientRow = { id: string; name: string; status: string };

export type TaskListFilters = {
  column_id?: string;
  /** `null` = só tarefas sem cliente. */
  cliente_id?: string | null;
  priority?: TaskPriority;
  flag_id?: string;
  busca?: string;
  prazo_de?: string;
  prazo_ate?: string;
  limite: number;
  offset: number;
};

/**
 * Acesso a dados das ferramentas, já preso a um usuário. A função roda com a chave secreta (sem
 * RLS), então TODA consulta daqui filtra `user_id` — é isso que isola uma conta da outra.
 */
export type TaskStore = {
  listColumns(): Promise<ColumnRow[]>;
  listFlags(): Promise<FlagRow[]>;
  listClients(): Promise<ClientRow[]>;
  listTasks(filters: TaskListFilters): Promise<{ rows: TaskRow[]; total: number }>;
  getTask(id: string): Promise<TaskRow | null>;
  insertTask(data: TaskWrite): Promise<TaskRow>;
  updateTask(id: string, data: Partial<TaskWrite>): Promise<TaskRow | null>;
  deleteTask(id: string): Promise<boolean>;
  replaceTaskFlags(taskId: string, currentIds: string[], nextIds: string[]): Promise<void>;
};

const TASK_SELECT =
  "id,title,description,priority,column_id,cliente_id,average_duration_minutes,due_date,created_at,updated_at,task_flag_links(flag_id)";

type TaskSelectRow = Omit<TaskRow, "flag_ids"> & {
  task_flag_links: { flag_id: string }[] | null;
};

function toTaskRow({ task_flag_links, ...task }: TaskSelectRow): TaskRow {
  return { ...task, flag_ids: (task_flag_links ?? []).map((link) => link.flag_id) };
}

/** Tira o que tem significado na sintaxe de filtro do PostgREST (`,` `(` `)` `"`) e os curingas. */
function sanitizeSearch(text: string) {
  return text
    .replace(/[,()"\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createSupabaseTaskStore(db: SupabaseClient, userId: string): TaskStore {
  return {
    async listColumns() {
      const { data, error } = await db
        .from("task_columns")
        .select("id,name,stage,position")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ColumnRow[];
    },

    async listFlags() {
      const { data, error } = await db
        .from("task_flags")
        .select("id,name,color")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FlagRow[];
    },

    async listClients() {
      const { data, error } = await db
        .from("clients")
        .select("id,name,status")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },

    async listTasks(filters) {
      let taskIds: string[] | null = null;
      if (filters.flag_id) {
        const { data, error } = await db
          .from("task_flag_links")
          .select("task_id")
          .eq("user_id", userId)
          .eq("flag_id", filters.flag_id)
          .limit(1000);
        if (error) throw error;
        taskIds = (data ?? []).map((link: { task_id: string }) => link.task_id);
        if (!taskIds.length) return { rows: [], total: 0 };
      }

      let query = db.from("tasks").select(TASK_SELECT, { count: "exact" }).eq("user_id", userId);
      if (taskIds) query = query.in("id", taskIds);
      if (filters.column_id) query = query.eq("column_id", filters.column_id);
      if (filters.cliente_id === null) query = query.is("cliente_id", null);
      else if (filters.cliente_id) query = query.eq("cliente_id", filters.cliente_id);
      if (filters.priority) query = query.eq("priority", filters.priority);
      if (filters.prazo_de) query = query.gte("due_date", filters.prazo_de);
      if (filters.prazo_ate) query = query.lte("due_date", filters.prazo_ate);
      const search = filters.busca ? sanitizeSearch(filters.busca) : "";
      if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(filters.offset, filters.offset + filters.limite - 1);
      if (error) throw error;
      return { rows: ((data ?? []) as TaskSelectRow[]).map(toTaskRow), total: count ?? 0 };
    },

    async getTask(id) {
      const { data, error } = await db
        .from("tasks")
        .select(TASK_SELECT)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? toTaskRow(data as TaskSelectRow) : null;
    },

    async insertTask(input) {
      const { data, error } = await db
        .from("tasks")
        .insert({ ...input, user_id: userId })
        .select(TASK_SELECT)
        .single();
      if (error) throw error;
      return toTaskRow(data as TaskSelectRow);
    },

    async updateTask(id, input) {
      const { data, error } = await db
        .from("tasks")
        .update(input)
        .eq("user_id", userId)
        .eq("id", id)
        .select(TASK_SELECT)
        .maybeSingle();
      if (error) throw error;
      return data ? toTaskRow(data as TaskSelectRow) : null;
    },

    async deleteTask(id) {
      const { data, error } = await db
        .from("tasks")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },

    // Remove antes de inserir: o banco limita a 5 flags por tarefa e conta as que ainda estão lá.
    async replaceTaskFlags(taskId, currentIds, nextIds) {
      const removedIds = currentIds.filter((id) => !nextIds.includes(id));
      const addedIds = nextIds.filter((id) => !currentIds.includes(id));

      if (removedIds.length) {
        const { error } = await db
          .from("task_flag_links")
          .delete()
          .eq("user_id", userId)
          .eq("task_id", taskId)
          .in("flag_id", removedIds);
        if (error) throw error;
      }
      if (addedIds.length) {
        const { error } = await db
          .from("task_flag_links")
          .insert(
            addedIds.map((flagId) => ({ task_id: taskId, flag_id: flagId, user_id: userId })),
          );
        if (error) throw error;
      }
    },
  };
}
