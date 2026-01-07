import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

let server = null;
let isShuttingDown = false;
let isReady = false;

/* ======================================================
   LOGGING HELPERS
====================================================== */
function logFatal(label, error) {
  console.error(`\n❌ ${label}:`, error?.message || error);
  if (error?.stack) console.error(error.stack);
}

const safeExit = (code = 1) => {
  setTimeout(() => process.exit(code), 300);
};

/* ======================================================
   CRASH SAFETY
====================================================== */
process.on("unhandledRejection", (reason) => {
  logFatal("Unhandled Promise Rejection", reason);
  initiateShutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logFatal("Uncaught Exception", error);
  initiateShutdown("uncaughtException");
});

/* ======================================================
   REQUIRED ENV VALIDATION
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
      `Missing Required Environment Variables:\n${missing.join("\n")}`
    );
  }

  const port = Number(process.env.PORT);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error("Invalid PORT value");
  }
}

/* ======================================================
   START SERVER
====================================================== */
async function startServer() {
  try {
    console.log("🔐 Loading AWS Secrets...");
    await loadSecrets().catch(async (e) => {
      console.warn("⚠️ AWS Secrets load failed — retrying...");
      await new Promise((r) => setTimeout(r, 1200));
      await loadSecrets();
    });
    console.log("✅ AWS Secrets Loaded");

    validateEnv();

    console.log("📦 Initializing Express App...");
    const { default: app } = await import("./app.js");

    if (server) {
      console.warn("⚠️ Server already running — preventing duplicate start");
      return;
    }

    /* ========= DB WARM CHECK ========= */
    console.log("🗄️ Checking database connection...");
    const { db } = await import("./config/db.js");
    await db.query("SELECT 1");
    console.log("🗄️ Database Connected");

    server = app.listen(process.env.PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server Running on Port: ${process.env.PORT}`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || "development"}`);
      console.log("📧 SMTP Ready");
      console.log("🧾 Zoho Billing Ready");
      console.log("🗄️ Database Ready");
      console.log("=======================================");
      isReady = true;
    });

    // Protect against stuck long requests
    server.setTimeout?.(120000);

    // Node should not exit unexpectedly
    server.keepAliveTimeout = 65000;

  } catch (err) {
    logFatal("Startup Failure", err);
    initiateShutdown("startup failure");
  }
}

/* ======================================================
   GRACEFUL SHUTDOWN
====================================================== */
async function initiateShutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️ Graceful Shutdown Initiated (${reason})...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("⏳ Forced shutdown — timeout exceeded");
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("🛑 HTTP Server stopped");
    }

    try {
      const { db } = await import("./config/db.js");
      await db.end?.();
      console.log("🗄️ Database connection closed");
    } catch (e) {
      console.warn("⚠️ Failed to close DB gracefully", e?.message);
    }

  } catch (err) {
    console.error("❌ Error during shutdown:", err);
  }

  clearTimeout(shutdownTimeout);
  safeExit(0);
}

/* ======================================================
   SIGNAL HANDLERS
====================================================== */
process.on("SIGTERM", () => initiateShutdown("SIGTERM"));
process.on("SIGINT", () => initiateShutdown("SIGINT"));

/* ======================================================
   HEALTH / READINESS (SAFE EXPORT)
====================================================== */
export function isAppReady() {
  return isReady && !isShuttingDown;
}

/* ======================================================
   BOOT
====================================================== */
startServer();
