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
import upgradeRoutes from "./routes/upgrade.route.js";
import billingRepair from "./routes/billingRepair.route.js";
import billingCron from "./routes/billingCron.route.js";
import billingSyncRoutes from "./routes/billingSync.route.js";
import exportsRoutes from "./routes/exports.routes.js";
import settingsRoutes from "./routes/settings.routes.js";

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
  // ✅ REMOVED bare IP entries — phones should always use the domain
  "https://wheelbrand.in",
  "https://www.wheelbrand.in",
  "https://promeet.zodopt.com",
  "https://www.promeet.zodopt.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, QR scanner)
    if (!origin) return callback(null, true);

    // Strip port 443 from origin if present (some mobile browsers add it)
    const normalizedOrigin = origin.replace(/:443$/, "").replace(/:80$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Log blocked origins always (not just dev) so you can catch new issues
    console.warn(`⚠️ CORS blocked: ${origin}`);
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
    "otp-token",          // ✅ FIX: required for visitor registration
    "x-access-token",     // ✅ FIX: fallback token header used in auth middleware
  ],
  exposedHeaders: [
    "Content-Range",
    "X-Content-Range",
    "Content-Disposition",
  ],
  maxAge: 600,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ================= COMPRESSION ================= */
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (res.getHeader("Content-Type")?.includes("spreadsheet")) return false;
      return compression.filter(req, res);
    },
  })
);

/* ================= BODY PARSER ================= */
app.use(express.json({ limit: "25mb", strict: false }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* ================= LOGGING ================= */
app.use((req, res, next) => {
  // Always log CORS origin in production so you can catch phone issues
  const origin = req.headers.origin || "no-origin";
  if (IS_PRODUCTION && req.path.includes("/api/public")) {
    console.log(`[PUBLIC] ${req.method} ${req.path} | Origin: ${origin}`);
  } else if (!IS_PRODUCTION) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | Origin: ${origin}`);
  }
  next();
});

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    environment: NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  });
});

/* ================= API INFO ================= */
app.get("/", (req, res) => {
  res.json({
    name: "ProMeet API",
    version: "1.0.0",
    status: "running",
    environment: NODE_ENV,
  });
});

/* =====================================================
   PUBLIC ROUTES (NO AUTH)
===================================================== */
app.use("/api/public", visitorPublicRouter);
app.use("/api/public/conference", conferencePublicRoutes);

/* =====================================================
   PROTECTED ROUTES (REQUIRE AUTH)
===================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/conference", conferenceRoutes);
app.use("/api/exports", exportsRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/upgrade", upgradeRoutes);
app.use("/api/payment/zoho", billingSyncRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/billing/repair", billingRepair);
app.use("/api/billing/cron", billingCron);
app.use("/api/webhook", webhookRoutes);

/* ================= 404 HANDLER ================= */
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
  if (!IS_PRODUCTION) console.error("Stack:", err.stack);

  if (err.message?.includes("CORS")) {
    return res.status(403).json({
      success: false,
      error: "CORS policy violation",
      message: `Origin not allowed: ${err.origin || "unknown"}`,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      message: err.message,
    });
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Authentication Error",
      message: "Invalid or expired token",
    });
  }

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      error: "Duplicate Entry",
      message: "Resource already exists",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: IS_PRODUCTION ? "Internal Server Error" : err.name || "Error",
    message: IS_PRODUCTION
      ? "Something went wrong"
      : err.message || "An unexpected error occurred",
  });
});

export default app;
