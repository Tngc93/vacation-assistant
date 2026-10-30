import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import { contentSecurityPolicy, serviceWorkerContentSecurityPolicy } from "./src/lib/security/csp";

/**
 * The build's name: the commit (Vercel, GitHub Actions, or the local checkout). The service worker is registered
 * as /sw.js?v=<build>, so every deploy installs a new worker and offers "Yeni sürüm hazır".
 */
function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // AGENTS.md is maintained by hand; don't let `next dev` append its managed block.
  agentRules: false,
  env: { NEXT_PUBLIC_VA_BUILD: buildId() },
  images: {
    // City photos come from Wikimedia Commons thumbnails only.
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/commons/**" },
      { protocol: "https", hostname: "thumb.wikimedia.org", pathname: "/wikipedia/commons/**" },
    ],
  },
  // The page may connect only to our origin, the map tiles and the three AI providers (src/lib/security/csp.ts);
  // the service worker only to our origin, the map tiles and Commons, never to an AI provider. The later rule wins.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy({ dev: process.env.NODE_ENV === "development" }) }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Security-Policy", value: serviceWorkerContentSecurityPolicy() },
          { key: "Cache-Control", value: "no-cache" },
        ],
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
