//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Services Imports
import {
  buildAiRequest,
  parseAiResponse,
  requestAi,
  toResponsesInput,
} from "../services/ai-service.ts";

//* Types Imports
import type { AiMessage, AiSettings } from "../lib/ai/types.ts";

//* Utils Imports
import { DEFAULT_AI_SETTINGS, parseAiSettings, AI_PROVIDERS } from "../lib/ai/models.ts";
import { aiStorageKey, readAiSettings, writeAiSettings } from "../lib/ai/settings-store.ts";
import { MCP_TOOLS } from "../lib/ai/mcp.ts";

const settings: AiSettings = {
  provider: "openai",
  model: "gpt-6.1-sol",
  token: "private-test-token",
};

describe("configuração da IA", () => {
  it("aceita modelo personalizado e impede provedores/URLs arbitrários", () => {
    assert.deepEqual(
      parseAiSettings({ provider: "gemini", model: " custom-model ", token: " key " }),
      {
        provider: "gemini",
        model: "custom-model",
        token: "key",
      },
    );
    assert.deepEqual(parseAiSettings({ provider: "__proto__", token: "key" }), DEFAULT_AI_SETTINGS);
    assert.deepEqual(
      parseAiSettings({ provider: "https://malicious.example", token: "key" }),
      DEFAULT_AI_SETTINGS,
    );
    for (const provider of Object.values(AI_PROVIDERS))
      assert.equal(new URL(provider.endpoint).protocol, "https:");
  });

  it("salva tokens separados por conta e tolera dados locais corrompidos", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => memory.set(key, value),
      },
    });
    try {
      writeAiSettings("account-a", settings);
      writeAiSettings("account-b", { ...settings, token: "second-token" });
      assert.equal(readAiSettings("account-a").token, "private-test-token");
      assert.equal(readAiSettings("account-b").token, "second-token");
      assert.equal(readAiSettings("account-c").token, "");
      memory.set(aiStorageKey("account-a"), "broken JSON");
      assert.deepEqual(readAiSettings("account-a"), DEFAULT_AI_SETTINGS);
      assert.throws(() => writeAiSettings("", settings));
    } finally {
      if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
});

describe("adaptadores de provedores", () => {
  it("conecta ao DeepSeek direto com token próprio e preserva raciocínio entre chamadas", async () => {
    const deepseek: AiSettings = {
      provider: "deepseek",
      model: "deepseek-flash",
      token: "deepseek-test-key",
    };
    assert.deepEqual(parseAiSettings(deepseek), deepseek);
    assert.equal(AI_PROVIDERS.deepseek.models[1].id, "deepseek-v4-pro");
    const tool = {
      id: "deepseek-call",
      type: "function",
      function: { name: "records_list", arguments: '{"resource":"tasks"}' },
    };
    const response = await requestAi(
      deepseek,
      [{ role: "user", content: "Liste tarefas" }],
      MCP_TOOLS,
      "Instruções",
      new AbortController().signal,
      async (url, init) => {
        assert.equal(url, "https://api.deepseek.com/chat/completions");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer deepseek-test-key");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, "deepseek-flash");
        assert.equal(body.tools.length, MCP_TOOLS.length);
        assert.equal(body.reasoning_effort, "low");
        assert.deepEqual(body.thinking, { type: "enabled" });
        assert.ok(!Object.hasOwn(body, "provider"));
        return Response.json({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                reasoning_content: "provider-context",
                tool_calls: [tool],
              },
            },
          ],
        });
      },
    );
    const next = buildAiRequest(
      deepseek,
      [response, { role: "tool", tool_call_id: tool.id, content: "[]" }],
      MCP_TOOLS,
      "Instruções",
    );
    assert.equal((next.messages as AiMessage[])[1].reasoning_content, "provider-context");
    assert.equal((next.messages as AiMessage[])[2].tool_call_id, tool.id);
    const custom = buildAiRequest({ ...deepseek, model: "my-custom-model" }, [], MCP_TOOLS, "");
    assert.equal(custom.model, "my-custom-model");
    assert.ok(!Object.hasOwn(custom, "thinking"));
  });

  it("usa Responses para ferramentas dos GPT atuais e não envia token no corpo", () => {
    const body = buildAiRequest(
      settings,
      [{ role: "user", content: "Minhas tarefas?" }],
      MCP_TOOLS,
      "Instruções",
    );
    assert.equal(body.store, false);
    assert.deepEqual(body.include, ["reasoning.encrypted_content"]);
    assert.equal((body.tools as { name: string }[])[0].name, "resources_describe");
    assert.ok(!JSON.stringify(body).includes(settings.token));
    assert.ok(!Object.hasOwn(body, "messages"));
  });

  it("preserva itens de raciocínio e associa resultados aos IDs no Responses", () => {
    const output = [
      { type: "reasoning", id: "r1", encrypted_content: "signature" },
      {
        type: "function_call",
        id: "fc1",
        call_id: "call1",
        name: "records_list",
        arguments: '{"resource":"tasks"}',
      },
    ];
    const response = parseAiResponse("openai", { status: "completed", output });
    const messages: AiMessage[] = [
      { role: "user", content: "Liste tarefas" },
      response,
      { role: "tool", tool_call_id: "call1", content: "Resultado" },
    ];
    assert.deepEqual(toResponsesInput(messages), [
      { role: "user", content: "Liste tarefas" },
      ...output,
      { type: "function_call_output", call_id: "call1", output: "Resultado" },
    ]);
  });

  it("preserva assinaturas/extra_content no OpenRouter e Gemini", () => {
    const tool = {
      id: "c1",
      type: "function",
      function: { name: "records_list", arguments: '{"resource":"tasks"}' },
      extra_content: { google: { thought_signature: "signed" } },
    };
    const response = parseAiResponse("gemini", {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [tool],
            reasoning_details: [{ type: "reasoning.encrypted", data: "encrypted" }],
          },
        },
      ],
    });
    const body = buildAiRequest(
      { ...settings, provider: "gemini", model: "gemini-3.8-flash" },
      [response],
      MCP_TOOLS,
      "Instruções",
    );
    const messages = body.messages as AiMessage[];
    assert.deepEqual(messages[1].tool_calls?.[0].extra_content, tool.extra_content);
    assert.deepEqual(messages[1].reasoning_details, response.reasoning_details);
  });

  it("adapta objetos dinâmicos para o schema de ferramentas do Gemini", () => {
    const body = buildAiRequest(
      { ...settings, provider: "gemini", model: "gemini-3.8-flash" },
      [],
      MCP_TOOLS,
      "",
    );
    const tools = body.tools as {
      function: { name: string; parameters?: { properties: Record<string, { type: string }> } };
    }[];
    assert.equal(
      tools.find((tool) => tool.function.name === "record_update")?.function.parameters?.properties
        .data.type,
      "string",
    );
    assert.equal(
      tools.find((tool) => tool.function.name === "records_list")?.function.parameters?.properties
        .filters.type,
      "string",
    );
    assert.equal(
      tools.find((tool) => tool.function.name === "resources_describe")?.function.parameters,
      undefined,
    );
  });

  it("rejeita respostas vazias, incompletas e chamadas inválidas", () => {
    assert.throws(
      () => parseAiResponse("openai", { status: "incomplete", output: [] }),
      /não concluiu/,
    );
    assert.throws(
      () => parseAiResponse("openai", { output: [{ type: "function_call" }] }),
      /inválida/,
    );
    assert.throws(() => parseAiResponse("gemini", { choices: [] }), /não retornou/);
    assert.throws(
      () =>
        parseAiResponse("openrouter", {
          choices: [{ finish_reason: "length", message: { content: "Parcial" } }],
        }),
      /limite/,
    );
  });

  it("envia chave apenas no Authorization do endpoint escolhido", async () => {
    const response = await requestAi(
      settings,
      [{ role: "user", content: "Olá" }],
      [],
      "Instruções",
      new AbortController().signal,
      async (url, init) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${settings.token}`);
        assert.equal(init?.credentials, "omit");
        assert.ok(!String(init?.body).includes(settings.token));
        return Response.json({
          output: [{ type: "message", content: [{ type: "output_text", text: "Olá!" }] }],
        });
      },
    );
    assert.equal(response.content, "Olá!");
  });

  it("trata erro de autenticação, créditos e remove chave das mensagens de erro", async () => {
    for (const [status, expected] of [
      [401, /Token inválido/],
      [429, /limite de uso/],
    ] as const) {
      await assert.rejects(
        requestAi(settings, [], [], "", new AbortController().signal, async () =>
          Response.json({ error: { message: "error" } }, { status }),
        ),
        expected,
      );
    }
    await assert.rejects(
      requestAi(settings, [], [], "", new AbortController().signal, async () =>
        Response.json({ error: { message: `Bad token ${settings.token}` } }, { status: 400 }),
      ),
      (error) =>
        error instanceof Error &&
        error.message.includes("[oculto]") &&
        !error.message.includes(settings.token),
    );
  });
});
