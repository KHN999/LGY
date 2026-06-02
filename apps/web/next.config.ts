import type { NextConfig } from "next";

// The /api/* proxy target, evaluated at build time. Railway injects API_URL into
// the build, so it's used in production; local dev falls back to the dev API.
const API_INTERNAL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lgy/db"],
  experimental: {
    // Trim chart-page bundles — import only the recharts/lucide modules used.
    optimizePackageImports: ["recharts", "lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
  // Proxy /api/* requests to the NestJS backend so the browser sees the same
  // origin and cookies "just work" without CORS gymnastics.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_INTERNAL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
