import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

/* ======================================================
   GLOBAL FAIL-SAFE LOGGING
====================================================== */
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  console.error(reason?.stack || reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

/* ======================================================
   SERVER BOOTSTRAP
====================================================== */
let server = null;

async function startServer() {
  try {
    console.log("🔐 Loading AWS Secrets...");

    // Load Secrets First
    await loadSecrets();
    console.log("✅ AWS Secrets Loaded");

    /* ================= REQUIRED ENV ================= */
    const REQUIRED_ENV = [
      "PORT",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",

      // ZOHO CRITICALS
      "ZOHO_ACCOUNTS_URL",
      "ZOHO_API_BASE",
      "ZOHO_REFRESH_TOKEN",
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET"
    ];

    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(
        `❌ Missing required environment variables: ${missing.join(", ")}`
      );
    }

    /* ================= NORMALIZE VALUES ================= */
    process.env.PORT = Number(process.env.PORT);
    if (!process.env.PORT || process.env.PORT <= 0) {
      throw new Error("❌ Invalid PORT value");
    }

    /* ================= LOAD EXPRESS ================= */
    console.log("📦 Initializing application...");
    const { default: app } = await import("./app.js");

    /* ================= START SERVER ================= */
    server = app.listen(process.env.PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server running on PORT: ${process.env.PORT}`);
      console.log(`🌍 ENV: ${process.env.NODE_ENV || "development"}`);
      console.log(`📧 SMTP: ${process.env.SMTP_USER}`);
      console.log(`💳 Zoho: Connected`);
      console.log("✅ Application Ready");
      console.log("=======================================");
    });

  } catch (error) {
    console.error("❌ Server startup failed");
    console.error(error?.message || error);
    if (error?.stack) console.error(error.stack);
    process.exit(1);
  }
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */
function shutdown(reason) {
  console.log(`\n⚠️  Shutting down (${reason})...`);

  if (server) {
    server.close(() => {
      console.log("🛑 Server stopped gracefully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* ======================================================
   START
====================================================== */
startServer();
