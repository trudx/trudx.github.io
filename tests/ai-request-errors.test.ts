//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Services Imports
import { requestAi } from "../services/ai-service.ts";

//* Types Imports
import type { AiSettings } from "../lib/ai/types.ts";

//* Utils Imports
import { AiRequestError, describeAiTransportFailure } from "../lib/ai/request-error.ts";

const settings: AiSettings = {
  provider: "deepseek",
  model: "deepseek-flash",
  token: "test-private-key",
};

describe("diagnóstico das chamadas de IA", () => {
  it("distingue falha de transporte e não inventa status HTTP nem atribui a CORS sem prova", async () => {
    await assert.rejects(
      requestAi(settings, [], [], "", new AbortController().signal, async () => {
        throw new TypeError("Failed to fetch");
      }),
      (error) =>
        error instanceof AiRequestError &&
        error.kind === "network" &&
        error.status === undefined &&
        error.message.includes("pode ser") &&
        error.message.includes("Diagnóstico:"),
    );
  });

  it("não transforma um TypeError ao processar HTTP 200 em erro de rede", async () => {
    await assert.rejects(
      requestAi(settings, [], [], "", new AbortController().signal, async () =>
        Response.json({ choices: [{ message: { tool_calls: [null] } }] }),
      ),
      (error) =>
        error instanceof AiRequestError &&
        error.kind === "invalid-response" &&
        error.status === 200,
    );
  });

  it("informa corpo inválido separadamente da falta de resposta HTTP", async () => {
    await assert.rejects(
      requestAi(
        settings,
        [],
        [],
        "",
        new AbortController().signal,
        async () =>
          new Response("<html>challenge</html>", {
            status: 403,
            headers: { "content-type": "text/html" },
          }),
      ),
      (error) =>
        error instanceof AiRequestError &&
        error.kind === "http" &&
        error.status === 403 &&
        error.message.includes("JSON"),
    );
  });

  it("distingue offline e timeout", () => {
    assert.equal(
      describeAiTransportFailure(new TypeError("Failed to fetch"), false, "DeepSeek", "id").kind,
      "offline",
    );
    assert.equal(
      describeAiTransportFailure(
        new DOMException("timeout", "TimeoutError"),
        true,
        "DeepSeek",
        "id",
      ).kind,
      "timeout",
    );
  });

  it("não consulta a rede se o pedido já foi cancelado", async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;
    await assert.rejects(
      requestAi(settings, [], [], "", controller.signal, async () => {
        called = true;
        return Response.json({});
      }),
    );
    assert.equal(called, false);
  });

  it("distingue falta de créditos HTTP 402 de autenticação inválida", async () => {
    await assert.rejects(
      requestAi(settings, [], [], "", new AbortController().signal, async () =>
        Response.json({ error: { message: "Insufficient balance" } }, { status: 402 }),
      ),
      (error) =>
        error instanceof AiRequestError &&
        error.status === 402 &&
        error.message.includes("sem créditos"),
    );
  });

  it("funciona sem AbortSignal.any e AbortSignal.timeout", async () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    const timeout = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: undefined });
    try {
      const response = await requestAi(
        settings,
        [],
        [],
        "",
        new AbortController().signal,
        async () => Response.json({ choices: [{ message: { content: "OK" } }] }),
      );
      assert.equal(response.content, "OK");
    } finally {
      if (any) Object.defineProperty(AbortSignal, "any", any);
      if (timeout) Object.defineProperty(AbortSignal, "timeout", timeout);
    }
  });
});
