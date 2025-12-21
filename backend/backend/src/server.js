import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

(async () => {
  try {
    /* ======================================================
       1️⃣ Load AWS Secrets FIRST
    ====================================================== */
    await loadSecrets();

    /* ======================================================
       2️⃣ Validate required SMTP configuration
    ====================================================== */
    const REQUIRED_ENV = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD"
    ];

    const missing = REQUIRED_ENV.filter(
      (key) => !process.env[key]
    );

    if (missing.length > 0) {
      throw new Error(
        `SMTP configuration missing: ${missing.join(", ")}`
      );
    }

    /* ======================================================
       3️⃣ Import app AFTER secrets & validation
    ====================================================== */
    const { default: app } = await import("./app.js");

    /* ======================================================
       4️⃣ Start HTTP server
    ====================================================== */
    const PORT = Number(process.env.PORT) || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📧 SMTP user: ${process.env.SMTP_USER}`);
      console.log("✅ Environment initialized successfully");
    });

  } catch (err) {
    console.error("❌ Server startup failed:");
    console.error(err.message);
    process.exit(1);
  }
})();
