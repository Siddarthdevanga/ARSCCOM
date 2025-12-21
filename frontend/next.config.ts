import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/login",
        destination: "/auth/login"
      },
      {
        source: "/forgot_password",
        destination: "/auth/forgot-password"
      }
    ];
  }
};

export default nextConfig;
