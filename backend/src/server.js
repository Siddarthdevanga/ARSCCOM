import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

let server = null;
let isShuttingDown = false;

/* ======================================================
   GLOBAL CRASH SAFETY
====================================================== */
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  console.error(reason?.stack || reason);
  initiateShutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  console.error(error?.stack || error);
  initiateShutdown("uncaughtException");
});

/* ======================================================
   VALIDATE REQUIRED ENV
====================================================== */
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

function validateEnv() {
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
}

/* ======================================================
   START SERVER
====================================================== */
async function startServer() {
  try {
    console.log("🔐 Loading secrets from AWS Secrets Manager...");
    await loadSecrets();
    console.log("✅ AWS Secrets loaded successfully");

    validateEnv();

    console.log("📦 Initializing Express App...");
    const { default: app } = await import("./app.js");

    if (server) {
      console.warn("⚠️ Server already running — preventing double start");
      return;
    }

    server = app.listen(process.env.PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server Running on Port: ${process.env.PORT}`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || "development"}`);
      console.log("📧 SMTP Loaded");
      console.log("🧾 Zoho Billing Ready");
      console.log("🗄️ Database Ready");
      console.log("=======================================");
    });

    // Prevent memory leaks with very long requests
    server.setTimeout?.(120000);

  } catch (err) {
    console.error("❌ Failed to start server");
    console.error(err?.message || err);
    if (err?.stack) console.error(err.stack);

    initiateShutdown("startup failure");
  }
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */
async function initiateShutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️ Shutting down server (${reason})...`);

  try {
    // Close express server if exists
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("🛑 HTTP Server stopped");
    }

    // Close DB pool safely if exists
    try {
      const { db } = await import("./config/db.js");
      await db.end?.();
      console.log("🗄️ Database connection closed");
    } catch {
      /* ignore db close errors */
    }

  } catch (err) {
    console.error("❌ Error during shutdown:", err);
  }

  process.exit(0);
}

process.on("SIGTERM", () => initiateShutdown("SIGTERM"));
process.on("SIGINT", () => initiateShutdown("SIGINT"));

/* ======================================================
   BOOT
====================================================== */
startServer();
