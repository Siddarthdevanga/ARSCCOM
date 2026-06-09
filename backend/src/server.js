import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

let server = null;
let isShuttingDown = false;
let isReady = false;

/* ======================================================
   LOGGING
====================================================== */
function logFatal(label, error) {
  console.error(`\n❌ ${label}:`, error?.message || error);
  if (error?.stack) console.error(error.stack);
}

const safeExit = (code = 1) => setTimeout(() => process.exit(code), 300);

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
   REQUIRED ENV
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
  if (Number.isNaN(port) || port <= 0) throw new Error("Invalid PORT value");
}

/* ======================================================
   START SERVER
====================================================== */
async function startServer() {
  try {
    /* ========= AWS SECRETS ========= */
    console.log("🔐 Loading AWS Secrets...");

    let loaded = false;
    for (let i = 1; i <= 3 && !loaded; i++) {
      try {
        await loadSecrets();
        loaded = true;
      } catch {
        console.warn(`⚠️ AWS Secrets load failed — retry ${i}`);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (!loaded) throw new Error("AWS Secrets Load Failed");

    console.log("✅ AWS Secrets Loaded");

    /* ========= ENV VALIDATION ========= */
    validateEnv();

    /* ========= EXPRESS ========= */
    console.log("📦 Initializing Express App...");
    const { default: app } = await import("./app.js");

    if (server) {
      console.warn("⚠️ Server already running — preventing duplicate start");
      return;
    }

    /* ========= DB READY ========= */
    console.log("🗄️ Checking database connection...");
    const { db } = await import("./config/db.js");
    await db.query("SELECT 1");
    console.log("🗄️ Database Connected");

    /* ========= START ========= */
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

    /* ========= GRACE PERIOD CRON JOB ========= */
    console.log("⏰ Initializing Grace Period Cron Job...");
    const cron = await import("node-cron");
    const { checkAndSendGracePeriodEmails } = await import("./cron/gracePeriodCron.js");

    // Run daily at 12:00 AM IST (midnight)
    cron.default.schedule('0 0 * * *', async () => {
      try {
        await checkAndSendGracePeriodEmails();
      } catch (error) {
        console.error("❌ Grace period cron job failed:", error);
      }
    }, {
      timezone: "Asia/Kolkata"
    });

    console.log("✅ Grace Period Cron Job Scheduled (Daily 12:00 AM IST)");

    /* ========= MEETING REMINDER CRON JOB ========= */
    const { sendMeetingReminders } = await import("./cron/reminderCron.js");
    cron.default.schedule('* * * * *', async () => {
      try { await sendMeetingReminders(); } catch (e) { console.error("❌ Reminder cron failed:", e); }
    }, { timezone: "Asia/Kolkata" });
    console.log("✅ Meeting Reminder Cron Scheduled (Every Minute IST)");

    const { sendDemoReminders } = await import("./cron/demoReminderCron.js");
    cron.default.schedule('* * * * *', async () => {
      try { await sendDemoReminders(); } catch (e) { console.error("❌ Demo reminder cron failed:", e); }
    }, { timezone: "Asia/Kolkata" });
    console.log("✅ Demo Appointment Reminder Cron Scheduled (Every Minute IST)");

    const { sendVisitorFeedback } = await import("./cron/visitorFeedbackCron.js");
    cron.default.schedule('* * * * *', async () => {
      try { await sendVisitorFeedback(); } catch (e) { console.error("❌ Visitor feedback cron failed:", e); }
    }, { timezone: "Asia/Kolkata" });
    console.log("✅ Visitor Feedback Cron Scheduled (Every Minute IST)");

    const { sendPostDemoMessages } = await import("./cron/postDemoCron.js");
    cron.default.schedule('* * * * *', async () => {
      try { await sendPostDemoMessages(); } catch (e) { console.error("❌ Post-demo cron failed:", e); }
    }, { timezone: "Asia/Kolkata" });
    console.log("✅ Post-Demo Follow-up Cron Scheduled (Every Minute IST)");

    const { sendNurtureMessages } = await import("./cron/nurtureCron.js");
    cron.default.schedule('* * * * *', async () => {
      try { await sendNurtureMessages(); } catch (e) { console.error("❌ Nurture cron failed:", e); }
    }, { timezone: "Asia/Kolkata" });
    console.log("✅ Nurture Cron Scheduled (Every Minute IST)");

    // protect long requests
    server.setTimeout?.(120000);
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
   SIGNALS
====================================================== */
process.on("SIGTERM", () => initiateShutdown("SIGTERM"));
process.on("SIGINT", () => initiateShutdown("SIGINT"));

/* ======================================================
   HEALTH
====================================================== */
export function isAppReady() {
  return isReady && !isShuttingDown;
}

/* ======================================================
   BOOT
====================================================== */
startServer();