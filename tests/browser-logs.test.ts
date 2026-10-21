//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Utils Imports
import {
  appendBrowserLog,
  browserLogsKey,
  browserLogStorageError,
  captureBrowserLogs,
  clearBrowserLogs,
  readBrowserLogs,
  redactDiagnostic,
  registerDiagnosticSecret,
} from "../lib/browser-logs.ts";
import { withLocalStorage } from "./helpers/local-storage.ts";

describe("logs locais do navegador", () => {
  it("mantém exatamente os últimos 100 e remove o mais antigo ao entrar outro", async () => {
    await withLocalStorage((values) => {
      const user = crypto.randomUUID();
      for (let index = 0; index < 105; index++)
        appendBrowserLog(user, { level: "info", source: "test", message: `log ${index}` });
      const logs = readBrowserLogs(user);
      assert.equal(logs.length, 100);
      assert.equal(logs[0].message, "log 5");
      assert.equal(logs.at(-1)?.message, "log 104");
      assert.equal(JSON.parse(values.get(browserLogsKey(user))!).length, 100);
      assert.equal(readBrowserLogs(user), logs);
      clearBrowserLogs(user);
      assert.deepEqual(readBrowserLogs(user), []);
    });
  });

  it("separa contas e limita o tamanho dos dados de cada registro", async () => {
    await withLocalStorage(() => {
      const first = crypto.randomUUID();
      const second = crypto.randomUUID();
      appendBrowserLog(first, {
        level: "error",
        source: "test",
        message: "a".repeat(20000),
        details: "b".repeat(20000),
      });
      assert.equal(readBrowserLogs(first)[0].message.length, 1600);
      assert.equal(readBrowserLogs(first)[0].details?.length, 4000);
      assert.deepEqual(readBrowserLogs(second), []);
    });
  });

  it("oculta segredos em objetos, texto, Bearer, JWT e URLs", () => {
    registerDiagnosticSecret("personal-private-key-123");
    const circular: Record<string, unknown> = {
      token: "token-value",
      Authorization: "header-value",
      password: "password-value",
      message: "personal-private-key-123",
    };
    circular.self = circular;
    const redacted = redactDiagnostic(circular);
    for (const secret of [
      "token-value",
      "header-value",
      "password-value",
      "personal-private-key-123",
    ])
      assert.ok(!redacted.includes(secret));
    assert.ok(
      !redactDiagnostic("Bearer unrecognized-credential").includes("unrecognized-credential"),
    );
    assert.ok(
      !redactDiagnostic("https://example.com/check?token=query-private").includes("query-private"),
    );
    assert.ok(!redactDiagnostic("sk-random-private-key").includes("sk-random-private-key"));
  });

  it("tolera dados corrompidos e continua em memória quando o armazenamento falha", async () => {
    await withLocalStorage((values) => {
      const user = crypto.randomUUID();
      values.set(browserLogsKey(user), "broken JSON");
      assert.deepEqual(readBrowserLogs(user), []);
      const storage = globalThis.localStorage;
      storage.setItem = () => {
        throw new Error("Quota exceeded");
      };
      appendBrowserLog(user, { level: "error", source: "test", message: "Ainda disponível" });
      assert.equal(readBrowserLogs(user).length, 1);
      assert.match(browserLogStorageError(user) ?? "", /memória/);
    });
  });

  it("captura console e restaura os métodos e listeners ao sair da conta", async () => {
    await withLocalStorage(() => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
      Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
      const original = console.error;
      console.error = () => {};
      const silent = console.error;
      const user = crypto.randomUUID();
      const stop = captureBrowserLogs(user, "test-private-credential");
      try {
        console.error("Falha: test-private-credential");
        assert.equal(readBrowserLogs(user)[0].source, "console.error");
        assert.ok(!readBrowserLogs(user)[0].message.includes("test-private-credential"));
      } finally {
        stop();
        assert.equal(console.error, silent);
        console.error = original;
        if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
        else Reflect.deleteProperty(globalThis, "window");
      }
    });
  });
});
