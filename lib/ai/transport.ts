//* Types Imports
import type { AiProviderId } from "./types.ts";

//* Utils Imports
import { AI_PROVIDERS } from "./models.ts";

export function aiDevelopmentRewrites() {
  return Object.entries(AI_PROVIDERS).map(([provider, config]) => ({
    source: `/api/ai/${provider}`,
    destination: config.endpoint,
  }));
}

export function aiRequestEndpoint(provider: AiProviderId, developmentBrowser: boolean) {
  return developmentBrowser ? `/api/ai/${provider}` : AI_PROVIDERS[provider].endpoint;
}
