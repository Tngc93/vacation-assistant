import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./src/lib/security/csp";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // AGENTS.md is maintained by hand; don't let `next dev` append its managed block.
  agentRules: false,
  images: {
    // City photos come from Wikimedia Commons thumbnails only.
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/commons/**" },
      { protocol: "https", hostname: "thumb.wikimedia.org", pathname: "/wikipedia/commons/**" },
    ],
  },
  // The page may connect only to our origin, the map tiles and the three AI providers (src/lib/security/csp.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy({ dev: process.env.NODE_ENV === "development" }) }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
