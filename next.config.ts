import type { NextConfig } from "next";

// Default to the deployed fly backend; override via BACKEND_URL env var (e.g. `http://localhost:4000` in dev).
const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "https://agentbank-api.fly.dev";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
