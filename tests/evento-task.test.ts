//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Services Imports
import { buildEventoTask, saveEventoWithTask } from "../services/evento-task-service.ts";

const input = {
  titulo: " Reunião ",
  descricao: " Alinhar entrega ",
  local: " Escritório ",
  data_inicio: new Date(2026, 9, 21, 10).toISOString(),
  data_fim: new Date(2026, 9, 21, 11, 30).toISOString(),
  dia_inteiro: false,
  cliente_id: "client-1",
};

describe("tarefa automática da agenda", () => {
  it("leva os dados do evento para a coluna escolhida", () => {
    assert.deepEqual(buildEventoTask(input, "column-2"), {
      title: "Reunião",
      description: "Alinhar entrega\n\nLocal: Escritório",
      priority: "medium",
      column_id: "column-2",
      cliente_id: "client-1",
      average_duration_minutes: 90,
      due_date: "2026-10-21",
    });
  });

  it("usa a data local do fim, mesmo quando o UTC já é outro dia", () => {
    const end = new Date(2026, 9, 21, 23, 45);
    assert.equal(
      buildEventoTask({ ...input, data_fim: end.toISOString() }, "column").due_date,
      "2026-10-21",
    );
  });

  it("usa 30 minutos em eventos de dia inteiro e no mínimo um minuto nos demais", () => {
    assert.equal(
      buildEventoTask({ ...input, dia_inteiro: true }, "column").average_duration_minutes,
      30,
    );
    assert.equal(
      buildEventoTask({ ...input, data_fim: input.data_inicio }, "column").average_duration_minutes,
      1,
    );
    assert.equal(buildEventoTask({ ...input, descricao: "", local: "" }, "column").description, "");
  });

  it("exige a coluna antes de gravar qualquer registro", async () => {
    let writes = 0;
    await assert.rejects(
      saveEventoWithTask(input, "", "user", "creation", {
        upsert: async () => {
          writes++;
        },
        remove: async () => {},
      }),
      /Escolha em qual coluna/,
    );
    assert.equal(writes, 0);
  });

  it("grava ambos com o usuário autenticado e reutiliza os IDs ao tentar novamente", async () => {
    const calls: { table: string; rows: object[]; options: object }[] = [];
    const persistence = {
      upsert: async (table: string, rows: object[], options: object) => {
        calls.push({ table, rows, options });
      },
      remove: async () => {
        assert.fail("Não deve desfazer um cadastro bem-sucedido");
      },
    };
    await saveEventoWithTask(input, "column", "user", "creation", persistence);
    await saveEventoWithTask(input, "column", "user", "creation", persistence);
    assert.deepEqual(
      calls.map(({ table }) => table),
      ["eventos", "tasks", "eventos", "tasks"],
    );
    for (const call of calls) {
      assert.deepEqual(call.options, { onConflict: "id" });
      assert.equal((call.rows[0] as { id: string }).id, "creation");
      assert.equal((call.rows[0] as { user_id: string }).user_id, "user");
    }
  });

  it("desfaz o cadastro quando a tarefa falha, incluindo uma resposta perdida após a gravação", async () => {
    const removed: string[] = [];
    const error = new Error("Task failed");
    await assert.rejects(
      saveEventoWithTask(input, "column", "user", "creation", {
        upsert: async (table) => {
          if (table === "tasks") throw error;
        },
        remove: async (table, filters) => {
          assert.deepEqual(filters, { id: "creation", user_id: "user" });
          removed.push(table);
        },
      }),
      (actual) => actual === error,
    );
    assert.deepEqual(removed.sort(), ["eventos", "tasks"]);
  });

  it("informa quando o cadastro não pôde ser desfeito", async () => {
    await assert.rejects(
      saveEventoWithTask(input, "column", "user", "creation", {
        upsert: async (table) => {
          if (table === "tasks") throw new Error("Task failed");
        },
        remove: async () => {
          throw new Error("Offline");
        },
      }),
      /Tente salvar novamente neste formulário/,
    );
  });

  it("não cria tarefa se a gravação do evento falhar", async () => {
    const tables: string[] = [];
    await assert.rejects(
      saveEventoWithTask(input, "column", "user", "creation", {
        upsert: async (table) => {
          tables.push(table);
          throw new Error("Offline");
        },
        remove: async () => {},
      }),
      /Offline/,
    );
    assert.deepEqual(tables, ["eventos"]);
  });
});
