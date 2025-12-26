import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

/* ======================================================
   GLOBAL PROCESS SAFETY
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
    console.log("🔐 Loading secrets from AWS...");

    /* ================= LOAD AWS SECRETS ================= */
    await loadSecrets();
    console.log("✅ Secrets loaded successfully");

    /* ================= VALIDATE SMTP ================= */
    const REQUIRED_ENV = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "PORT"
    ];

    const missing = REQUIRED_ENV.filter((k) => !process.env[k]);

    if (missing.length) {
      throw new Error(
        `❌ Missing required environment variables: ${missing.join(", ")}`
      );
    }

    /* ================= NORMALIZE ================= */
    process.env.PORT = Number(process.env.PORT);

    if (Number.isNaN(process.env.PORT) || process.env.PORT <= 0) {
      throw new Error("❌ Invalid PORT value");
    }

    /* ================= LOAD EXPRESS APP ================= */
    console.log("📦 Initializing application...");
    const { default: app } = await import("./app.js");

    /* ================= START SERVER ================= */
    server = app.listen(process.env.PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server running on port ${process.env.PORT}`);
      console.log(`📧 SMTP User: ${process.env.SMTP_USER}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log("✅ Application ready");
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
  console.log(`\n⚠️  Shutting down server (${reason})...`);

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
