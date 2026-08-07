/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizeCss: false,
  },
  // Logo files get updated in place (same filename each time) rather than
  // versioned — without this, browsers cache the old bytes against that
  // stable URL and keep showing a stale logo even after a correct deploy,
  // until the user does a hard refresh. must-revalidate forces a
  // conditional request every time so a fresh upload is picked up
  // immediately without needing cache-busting query strings everywhere
  // the logo is referenced.
  async headers() {
    return [
      {
        source: "/:path*.(png|jpg|jpeg|svg|webp)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
