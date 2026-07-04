/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizeCss: false,
  },
};

module.exports = nextConfig;
