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
import upgradeRoutes from "./routes/upgrade.routes.js";
import billingRepair from "./routes/billingRepair.route.js";
import billingCron from "./routes/billingCron.route.js";
import billingSyncRoutes from "./routes/billingSync.route.js";
import exportsRoutes from "./routes/exports.routes.js";

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
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Log blocked origins in development
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
  exposedHeaders: [
    "Content-Range", 
    "X-Content-Range",
    "Content-Disposition", // Important for file downloads
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
      // Don't compress file downloads
      if (res.getHeader("Content-Type")?.includes("spreadsheet")) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

/* ================= BODY PARSER ================= */
app.use(express.json({ limit: "25mb", strict: false }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* ================= LOGGING ================= */
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });
}

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
    endpoints: {
      public: [
        "/api/public",
        "/api/public/conference",
      ],
      protected: [
        "/api/auth",
        "/api/visitors",
        "/api/conference",
        "/api/exports",
        "/api/payment",
        "/api/subscription",
        "/api/upgrade",
      ],
    },
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

// Authentication
app.use("/api/auth", authRoutes);

// Visitor Management
app.use("/api/visitors", visitorRoutes);

// Conference Room Management
app.use("/api/conference", conferenceRoutes);

// Data Exports (Excel downloads)
app.use("/api/exports", exportsRoutes);

// Payment & Subscription Management
app.use("/api/payment", paymentRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/upgrade", upgradeRoutes);
app.use("/api/payment/zoho", billingSyncRoutes);

// Billing Management
app.use("/api/billing/repair", billingRepair);
app.use("/api/billing/cron", billingCron);

// Webhooks
app.use("/api/webhook", webhookRoutes);

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.originalUrl} does not exist`,
    availableRoutes: [
      "/health",
      "/api/public",
      "/api/public/conference",
      "/api/auth",
      "/api/visitors",
      "/api/conference",
      "/api/exports",
      "/api/payment",
      "/api/subscription",
      "/api/upgrade",
    ],
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  // Log error details
  console.error("❌ ERROR:", err.message);
  
  if (!IS_PRODUCTION) {
    console.error("Stack:", err.stack);
  }

  // Handle CORS errors
  if (err.message?.includes("CORS")) {
    return res.status(403).json({
      success: false,
      error: "CORS policy violation",
      message: "Origin not allowed",
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      message: err.message,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Authentication Error",
      message: "Invalid or expired token",
    });
  }

  // Handle database errors
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      error: "Duplicate Entry",
      message: "Resource already exists",
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: IS_PRODUCTION ? "Internal Server Error" : err.name || "Error",
    message: IS_PRODUCTION
      ? "Something went wrong"
      : err.message || "An unexpected error occurred",
  });
});

/* ================= GRACEFUL SHUTDOWN ================= */
const shutdown = (signal) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  
  // Close server and cleanup
  setTimeout(() => {
    console.log("✅ Cleanup completed. Exiting...");
    process.exit(0);
  }, 1000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err);
  console.error("Stack:", err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 UNHANDLED REJECTION at:", promise);
  console.error("Reason:", reason);
  process.exit(1);
});

export default app;
```
