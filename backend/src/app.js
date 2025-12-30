import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

/* ================= ROUTES ================= */
import authRoutes from "./routes/auth.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";
import conferencePublicRoutes from "./routes/conference.public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriptionRoutes from "./routes/subscription.route.js";

const app = express();

/* ======================================================
   SECURITY + PERFORMANCE
====================================================== */

// Trust Proxy (Required for AWS / NGINX / HTTPS)
app.set("trust proxy", 1);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow logo + assets loading
  })
);

// Response Compression
app.use(
  compression({
    level: 6,
    threshold: 1024
  })
);

/* ======================================================
   CORS
====================================================== */
const allowedOrigins = [
  "http://localhost:3000",
  "http://13.205.13.110",
  "http://13.205.13.110:3000",
  "https://wheelbrand.in",
  "https://www.wheelbrand.in"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / Backend Requests
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.warn("❌ BLOCKED ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

/* ======================================================
   BODY PARSERS
====================================================== */
// Must stay BEFORE routes
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV || "development"
  });
});

/* ======================================================
   ROUTES
====================================================== */

// AUTH
app.use("/api/auth", authRoutes);

// VISITORS
app.use("/api/visitors", visitorRoutes);

// CONFERENCE (ADMIN)
app.use("/api/conference", conferenceRoutes);

// CONFERENCE (PUBLIC)
app.use("/api/public/conference", conferencePublicRoutes);

// PAYMENT & BILLING
app.use("/api/payment", paymentRoutes);

// SUBSCRIPTION DETAILS (Frontend Popup)
app.use("/api/subscription", subscriptionRoutes);

// ZOHO WEBHOOK (KEEP BEFORE 404 ALWAYS)
app.use("/api/webhook", webhookRoutes);

/* ======================================================
   404 HANDLER
====================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err?.message || err);
  if (err?.stack) console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
});

export default app;

