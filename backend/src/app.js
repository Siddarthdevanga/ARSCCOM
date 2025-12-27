import express from "express";
import cors from "cors";

/* ================= ROUTES ================= */
import authRoutes from "./routes/auth.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";
import conferenceRoutes from "./routes/conference.routes.js";
import conferencePublicRoutes from "./routes/conference.public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();

/* ======================================================
   GLOBAL MIDDLEWARE
====================================================== */

/* ---------- CORS (CRITICAL) ---------- */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://13.205.13.110",
      "http://13.205.13.110:3000",
      "https://www.wheelbrand.in"
    ],
    credentials: true
  })
);

/* ---------- BODY PARSERS ---------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

/* ======================================================
   ROUTES
====================================================== */

/* AUTH */
app.use("/api/auth", authRoutes);

/* VISITOR */
app.use("/api/visitors", visitorRoutes);

/* CONFERENCE (ADMIN – AUTH REQUIRED) */
app.use("/api/conference", conferenceRoutes);

/* CONFERENCE (PUBLIC – OTP + BOOKING) */
app.use("/api/public/conference", conferencePublicRoutes);

/* PAYMENT + BILLING */
app.use("/api/payment", paymentRoutes);

/* ZOHO BILLING WEBHOOK */
app.use("/api/webhook", webhookRoutes);

/* ======================================================
   404 HANDLER
====================================================== */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

export default app;
