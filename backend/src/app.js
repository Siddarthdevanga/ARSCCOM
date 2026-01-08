import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import authRoutes from "./routes/auth.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";
import conferencePublicRoutes from "./routes/conference.public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriptionRoutes from "./routes/subscription.route.js";
import billingRepair from "./routes/billingRepair.route.js";
import billingCron from "./routes/billingCron.route.js";
import billingSyncRoutes from "./routes/billingSync.route.js";

const app = express();

/* ================= PROXY ================= */
app.set("trust proxy", 1);

/* ================= SECURITY ================= */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

/* ================= CORS ================= */
const allowedOrigins = [
  "http://localhost:3000",
  "http://13.205.13.110",
  "http://13.205.13.110:3000",

  // Old domain (keep)
  "https://wheelbrand.in",
  "https://www.wheelbrand.in",

  // New domain
  "https://promeet.zodopt.com",
  "https://www.promeet.zodopt.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, curl, same-origin
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("❌ BLOCKED CORS ORIGIN:", origin);
    return callback(null, false); // IMPORTANT: do NOT throw error
  },
  credentials: true,
};

/* Apply CORS */
app.use(cors(corsOptions));

/* Handle OPTIONS preflight using SAME rules */
app.options("*", cors(corsOptions));

/* ================= COMPRESSION ================= */
app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);

/* ================= BODY PARSER ================= */
app.use(express.json({ limit: "25mb", strict: false }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV || "development",
  });
});

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/conference", conferenceRoutes);
app.use("/api/public/conference", conferencePublicRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/billing/repair", billingRepair);
app.use("/api/billing/cron", billingCron);
app.use("/api/payment/zoho", billingSyncRoutes);
app.use("/api/webhook", webhookRoutes);

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* ================= GLOBAL ERROR ================= */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err?.message || err);
  if (err?.stack) console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

export default app;
