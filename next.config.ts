//* Utils Imports
import { aiDevelopmentRewrites } from "./lib/ai/transport.ts";

//* Types Imports
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development"
    ? { rewrites: async () => aiDevelopmentRewrites() }
    : { output: "export" as const }),

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
