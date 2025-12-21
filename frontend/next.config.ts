import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/login",
        destination: "/auth/login"
      },
      {
        source: "/forgot-password",
        destination: "/auth/forgot-password"
      }
    ];
  }
};

export default nextConfig;
