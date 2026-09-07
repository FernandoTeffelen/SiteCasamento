import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.74"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
