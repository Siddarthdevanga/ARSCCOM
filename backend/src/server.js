import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

let server = null;

/* ======================================================
   GLOBAL CRASH SAFETY
====================================================== */
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  console.error(reason?.stack || reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  console.error(error?.stack || error);
  process.exit(1);
});

/* ======================================================
   START SERVER
====================================================== */
async function startServer() {
  try {
    console.log("🔐 Loading secrets from AWS Secrets Manager...");
    await loadSecrets();
    console.log("✅ AWS Secrets loaded successfully");

    /* ---------- VALIDATE REQUIRED ENV ---------- */
    const REQUIRED = [
      "PORT",

      // DB
      "DB_HOST",
      "DB_USER",
      "DB_PASSWORD",
      "DB_NAME",

      // SMTP
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",

      // ZOHO
      "ZOHO_ACCOUNTS_URL",
      "ZOHO_API_BASE",
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_REFRESH_TOKEN"
    ];

    const missing = REQUIRED.filter((v) => !process.env[v]);

    if (missing.length) {
      throw new Error(
        `❌ Missing Environment Variables:\n${missing.join("\n")}`
      );
    }

    process.env.PORT = Number(process.env.PORT);

    if (Number.isNaN(process.env.PORT) || process.env.PORT <= 0) {
      throw new Error("❌ Invalid PORT value");
    }

    console.log("📦 Initializing Express App...");
    const { default: app } = await import("./app.js");

    /* ---------- START SERVER ---------- */
    server = app.listen(process.env.PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server Running on Port: ${process.env.PORT}`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || "development"}`);
      console.log("📧 SMTP Loaded");
      console.log("🧾 Zoho Billing Ready");
      console.log("🗄️ Database Connected");
      console.log("=======================================");
    });

  } catch (err) {
    console.error("❌ Failed to start server");
    console.error(err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */
function shutdown(reason) {
  console.log(`\n⚠️ Shutting down server (${reason})...`);

  if (!server) return process.exit(0);

  server.close(() => {
    console.log("🛑 Server stopped gracefully");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/* ======================================================
   BOOT
====================================================== */
startServer();
