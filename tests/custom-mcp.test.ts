import assert from "node:assert/strict";
import { it } from "node:test";

import { connectCustomMcpServers } from "../lib/ai/custom-mcp-client.ts";
import { importClaudeMcp, validateMcpConfig } from "../lib/ai/custom-mcp-config.ts";

it("importa servidores HTTP do Claude Code sem interpretar comandos ou variáveis", () => {
  const servers = importClaudeMcp(
    JSON.stringify({
      mcpServers: {
        remoto: { type: "http", url: "https://example.test/mcp", headers: { Authorization: "Bearer test-token" } },
        local: { command: "npx", args: ["server"] },
      },
    }),
  );
  assert.deepEqual(servers, [
    {
      name: "remoto",
      url: "https://example.test/mcp",
      headers: { authorization: "Bearer test-token" },
    },
  ]);
  assert.throws(() => validateMcpConfig("teste", "http://example.test/mcp", {}), /HTTPS/);
  assert.throws(
    () => validateMcpConfig("teste", "https://example.test/mcp", { Authorization: "Bearer ${TOKEN}" }),
    /variáveis/,
  );
  assert.throws(() => validateMcpConfig("teste", "https://example.test/mcp?token=${TOKEN}", {}), /variáveis/);
});

it("descobre ferramentas paginadas, mantém a sessão e chama apenas ferramentas habilitadas", async ({ mock }) => {
  const endpoint = "https://example.test/mcp";
  const headers = { authorization: "Bearer test-token" };
  const sessionId = "test-session";
  const version = "2025-06-18";
  const tool = { name: "buscar:itens", inputSchema: { type: "object" } };
  const otherTool = { name: "excluir", inputSchema: { type: "object" } };
  const calls: string[] = [];
  const transport = mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, options?: RequestInit) => {
    const sent = new Headers(options?.headers);
    assert.equal(sent.get("authorization"), headers.authorization);
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.redirect, "error");
    if (options?.method === "DELETE") {
      assert.equal(sent.get("Mcp-Session-Id"), sessionId);
      calls.push("DELETE");
      return new Response(null, { status: 204 });
    }

    const request = JSON.parse(String(options?.body));
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id: request.id, result });
    calls.push(request.method);
    if (request.method === "initialize") {
      assert.equal(sent.has("Mcp-Session-Id"), false);
      return Response.json(reply({ protocolVersion: version }), { headers: { "Mcp-Session-Id": sessionId } });
    }
    assert.equal(sent.get("Mcp-Session-Id"), sessionId);
    assert.equal(sent.get("MCP-Protocol-Version"), version);
    if (request.method === "notifications/initialized") {
      assert.equal("id" in request, false);
      return new Response(null, { status: 202 });
    }
    if (request.method === "tools/list") {
      return Response.json(
        reply(
          request.params?.cursor
            ? { tools: [tool] }
            : {
                tools: [otherTool],
                nextCursor: "page-2",
              },
        ),
      );
    }
    assert.equal(request.method, "tools/call");
    assert.deepEqual(request.params, { name: tool.name, arguments: { value: 1 } });
    const event = JSON.stringify(reply({ content: [{ type: "text", text: "Resposta para test-token" }] }));
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`event: message\r\ndata: ${event}\r\n\r\n`));
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream" } });
  });
  const connection = await connectCustomMcpServers(
    [
      { id: "id-1", name: "Servidor", url: endpoint, headers, enabled_tools: [tool.name] },
      { id: "id-2", name: "Desativado", url: endpoint, headers, enabled_tools: [] },
    ],
    new AbortController().signal,
  );
  try {
    assert.equal(connection.failures, 0);
    assert.equal(connection.tools.length, 1);
    const [registered] = connection.tools;
    assert.match(registered.name, /^mcp_buscar_itens_[a-f0-9]+$/);
    assert.equal(connection.call(otherTool.name, {}), undefined);
    assert.deepEqual(await connection.call(registered.name, { value: 1 }), {
      content: [{ type: "text", text: "Resposta para [oculto]" }],
    });
  } finally {
    connection.close();
  }
  assert.equal(transport.mock.callCount(), 6);
  assert.deepEqual(calls, [
    "initialize",
    "notifications/initialized",
    "tools/list",
    "tools/list",
    "tools/call",
    "DELETE",
  ]);
});
