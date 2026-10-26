//* Utils Imports
import { aiDevelopmentRewrites } from "./lib/ai/transport.ts";

//* Types Imports
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development"
    ? {
        rewrites: async () => aiDevelopmentRewrites(),
        // O proxy de dev corta em 30 s por padrão; modelos com raciocínio levam mais que isso.
        experimental: { proxyTimeout: 120_000 },
      }
    : { output: "export" as const }),

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
