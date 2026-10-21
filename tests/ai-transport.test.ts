//* Libraries Imports
import assert from "node:assert/strict";
import { describe, it } from "node:test";

//* Utils Imports
import { aiDevelopmentRewrites, aiRequestEndpoint } from "../lib/ai/transport.ts";
import { AI_PROVIDERS } from "../lib/ai/models.ts";

describe("transporte local da IA", () => {
  it("usa a mesma origem do app em desenvolvimento e o endpoint oficial no site estático", () => {
    assert.equal(aiRequestEndpoint("deepseek", true), "/api/ai/deepseek");
    assert.equal(aiRequestEndpoint("deepseek", false), "https://api.deepseek.com/chat/completions");
  });

  it("encaminha apenas rotas fixas aos endpoints permitidos, sem destinos arbitrários", () => {
    const rewrites = aiDevelopmentRewrites();
    assert.equal(rewrites.length, Object.keys(AI_PROVIDERS).length);
    assert.ok(
      rewrites.some(
        (rewrite) =>
          rewrite.source === "/api/ai/deepseek" &&
          rewrite.destination === "https://api.deepseek.com/chat/completions",
      ),
    );
    for (const rewrite of rewrites) {
      assert.ok(!rewrite.source.includes(":"));
      assert.equal(new URL(rewrite.destination).protocol, "https:");
      assert.ok(!Object.hasOwn(rewrite, "headers"));
    }
  });
});
