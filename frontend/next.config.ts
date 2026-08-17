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
  // The auth pages moved from /auth/<page> to top-level /<page> routes.
  // Old links already sent out (emails, WhatsApp messages, bookmarks) still
  // point at /auth/<page> — these keep them working instead of 404ing.
  async redirects() {
    const movedPages = [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "subscription",
      "complete-registration",
      "contact-us",
    ];
    return movedPages.map((page) => ({
      source: `/auth/${page}`,
      destination: `/${page}`,
      permanent: true,
    }));
  },
};

module.exports = nextConfig;
