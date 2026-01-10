import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

/* ================= ROUTE IMPORTS ================= */
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

/* ================= ENVIRONMENT VARIABLES ================= */
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

/* ================= TRUST PROXY ================= */
// Enable if behind reverse proxy (nginx, load balancer)
app.set("trust proxy", 1);

/* ================= SECURITY MIDDLEWARE ================= */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: IS_PRODUCTION ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    } : false,
    hsts: IS_PRODUCTION ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
  })
);

/* ================= CORS CONFIGURATION ================= */
const allowedOrigins = [
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  
  // Server IP
  "http://13.205.13.110",
  "http://13.205.13.110:3000",
  
  // Production domains
  "https://wheelbrand.in",
  "https://www.wheelbrand.in",
  "https://promeet.zodopt.com",
  "https://www.promeet.zodopt.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origins in development
    if (!IS_PRODUCTION) {
      console.warn(`⚠️  CORS blocked: ${origin}`);
    }

    // Reject with CORS error
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false);
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
  maxAge: 600, // Cache preflight for 10 minutes
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

/* ================= COMPRESSION ================= */
app.use(
  compression({
    level: 6, // Compression level (0-9, higher = more compression but slower)
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers["x-no-compression"]) {
        return false;
      }
      // Use compression filter
      return compression.filter(req, res);
    },
  })
);

/* ================= BODY PARSER ================= */
app.use(express.json({ 
  limit: "25mb",
  strict: false,
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: "25mb",
}));

/* ================= REQUEST LOGGING (Development) ================= */
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
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
  });
});

/* ================= API INFO ================= */
app.get("/", (req, res) => {
  res.json({
    name: "ProMeet API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      visitors: "/api/visitors",
      conference: "/api/conference",
      publicConference: "/api/public/conference",
      payment: "/api/payment",
      subscription: "/api/subscription",
      webhook: "/api/webhook",
    },
  });
});

/* ================= API ROUTES ================= */
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

/* ================= 404 HANDLER ================= */
app.use((req, res) => {
  console.warn(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.originalUrl} does not exist`,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  // Log error details
  console.error("❌ GLOBAL ERROR:");
  console.error("Message:", err?.message || "Unknown error");
  console.error("Path:", req.originalUrl);
  console.error("Method:", req.method);
  
  if (err?.stack && !IS_PRODUCTION) {
    console.error("Stack:", err.stack);
  }

  // CORS errors
  if (err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "CORS policy violation",
    });
  }

  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Invalid JSON payload",
    });
  }

  // Payload too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Payload Too Large",
      message: "Request body exceeds size limit",
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: IS_PRODUCTION ? "Internal Server Error" : err.name || "Error",
    message: IS_PRODUCTION 
      ? "Something went wrong. Please try again later." 
      : err.message || "An unexpected error occurred",
    ...((!IS_PRODUCTION && err.stack) && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
});

/* ================= GRACEFUL SHUTDOWN ================= */
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
  
  // Close server and cleanup
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

/* ================= UNHANDLED REJECTIONS ================= */
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  
  if (!IS_PRODUCTION) {
    // In development, log but don't exit
    return;
  }
  
  // In production, exit gracefully
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:");
  console.error(error);
  
  // Always exit on uncaught exceptions
  process.exit(1);
});

/* ================= EXPORT ================= */
export default app;
