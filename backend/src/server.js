import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

/* ======================================================
   GLOBAL PROCESS SAFETY
====================================================== */
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

/* ======================================================
   SERVER BOOTSTRAP
====================================================== */
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
      "SMTP_PASSWORD"
    ];

    const missing = REQUIRED_ENV.filter(
      (key) => !process.env[key]
    );

    if (missing.length) {
      throw new Error(
        `Missing SMTP configuration: ${missing.join(", ")}`
      );
    }

    /* ================= VALIDATE PORT ================= */
    const PORT = Number(process.env.PORT);

    if (!PORT || Number.isNaN(PORT)) {
      throw new Error("Invalid or missing PORT environment variable");
    }

    /* ================= LOAD EXPRESS APP ================= */
    console.log("📦 Initializing application...");

    const { default: app } = await import("./app.js");

    /* ================= START SERVER ================= */
    app.listen(PORT, () => {
      console.log("=======================================");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📧 SMTP User: ${process.env.SMTP_USER}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log("✅ Application ready");
      console.log("=======================================");
    });

  } catch (error) {
    console.error("❌ Server startup failed");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

/* ======================================================
   START
====================================================== */
startServer();
