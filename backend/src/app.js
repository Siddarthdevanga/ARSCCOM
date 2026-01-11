import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

/* ================= ROUTE IMPORTS ================= */
import authRoutes from "./routes/auth.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";
import visitorPublicRouter from "./routes/visitor-public.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";
import conferencePublicRoutes from "./routes/conference.public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriptionRoutes from "./routes/subscription.route.js";
import billingRepair from "./routes/billingRepair.route.js";
import billingCron from "./routes/billingCron.route.js";
import billingSyncRoutes from "./routes/billingSync.route.js";

const app = express();

/* ================= ENV ================= */
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

/* ================= TRUST PROXY ================= */
app.set("trust proxy", 1);

/* ================= SECURITY ================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: IS_PRODUCTION
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        }
      : false,
    hsts: IS_PRODUCTION
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  })
);

/* ================= CORS ================= */
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://13.205.13.110",
  "http://13.205.13.110:3000",
  "https://wheelbrand.in",
  "https://www.wheelbrand.in",
  "https://promeet.zodopt.com",
  "https://www.promeet.zodopt.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    if (!IS_PRODUCTION) {
      console.warn(`⚠️ CORS blocked: ${origin}`);
    }
    return callback(new Error("CORS policy violation"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600,
};

app.use(cors(corsOptions));
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

/* ================= LOGGING ================= */
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ================= API INFO ================= */
app.get("/", (req, res) => {
  res.json({
    name: "ProMeet API",
    version: "1.0.0",
    status: "running",
  });
});

/* =====================================================
   PUBLIC ROUTES (NO AUTH)
===================================================== */
app.use("/api/public", visitorPublicRouter);
app.use("/api/public/conference", conferencePublicRoutes);

/* =====================================================
   PROTECTED ROUTES
===================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/conference", conferenceRoutes);
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
    error: "Not Found",
    message: `Route ${req.originalUrl} does not exist`,
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);

  if (err.message?.includes("CORS")) {
    return res.status(403).json({
      success: false,
      error: "CORS policy violation",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: IS_PRODUCTION ? "Internal Server Error" : err.name,
    message: IS_PRODUCTION
      ? "Something went wrong"
      : err.message,
  });
});

/* ================= SHUTDOWN ================= */
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received. Shutting down...`);
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
