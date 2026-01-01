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
import billingRepair from "./routes/billingRepair.route.js";

const app = express();

/* ======================================================
   TRUST PROXY (IMPORTANT for HTTPS / AWS / NGINX / Cloudflare)
====================================================== */
app.set("trust proxy", 1);

/* ======================================================
   SECURITY HEADERS
====================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: false // allow external logo/images
  })
);

/* ======================================================
   PERFORMANCE
====================================================== */
app.use(
  compression({
    level: 6,
    threshold: 1024
  })
);

/* ======================================================
   CORS CONFIGURATION
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
      if (!origin) return callback(null, true); // Postman / Server Internal Calls
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.warn("❌ BLOCKED CORS ORIGIN:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

/* ======================================================
   BODY PARSERS
====================================================== */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* ======================================================
   HEALTH CHECK ENDPOINT
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
   ROUTE MAPPINGS
====================================================== */

// AUTH
app.use("/api/auth", authRoutes);

// VISITORS
app.use("/api/visitors", visitorRoutes);

// CONFERENCE (ADMIN)
app.use("/api/conference", conferenceRoutes);

// CONFERENCE (PUBLIC)
app.use("/api/public/conference", conferencePublicRoutes);

// PAYMENT
app.use("/api/payment", paymentRoutes);

// SUBSCRIPTION DETAILS (3-dot popup)
app.use("/api/subscription", subscriptionRoutes);

// BILLING REPAIR / RESYNC TOOL
app.use("/api/billing/repair", billingRepair);

// ZOHO WEBHOOK (IMPORTANT — Must be before 404)
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
