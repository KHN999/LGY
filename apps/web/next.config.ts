import type { NextConfig } from "next";

// The /api/* proxy target, evaluated at build time. We confirmed Vercel does not
// reliably expose API_URL to next.config at build, so on Vercel we default to the
// public production API (a public, non-secret URL). API_URL still wins if present;
// local dev uses the dev API.
const API_INTERNAL =
  process.env.API_URL ??
  (process.env.VERCEL
    ? "https://lgyapi-production.up.railway.app"
    : "http://localhost:4000");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lgy/db"],
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
