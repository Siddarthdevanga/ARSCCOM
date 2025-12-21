import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import visitorRoutes from "./routes/visitor.routes.js";

const app = express();

/* ======================================================
   GLOBAL MIDDLEWARE
====================================================== */

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://13.205.13.110",
      "http://13.205.13.110:3000"
    ],
    credentials: true
  })
);


// Body parsers (REQUIRED for req.body)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/health", (req, res) => {
  return res.status(200).json({ status: "OK" });
});

/* ======================================================
   ROUTES
====================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/visitors", visitorRoutes);

/* ======================================================
   404 HANDLER
====================================================== */
app.use((req, res) => {
  return res.status(404).json({
    message: "Route not found"
  });
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  return res.status(500).json({
    message: "Internal Server Error"
  });
});

export default app;
