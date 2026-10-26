import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  // Proxy cloning must preserve enough bytes for the route's 12 MiB check.
  experimental: { proxyClientMaxBodySize: 13 * 1024 * 1024 },
  turbopack: {},
};

export default nextConfig;
