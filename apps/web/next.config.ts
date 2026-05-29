import type { NextConfig } from "next";

const API_INTERNAL = process.env.API_URL ?? "http://localhost:4000";

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
