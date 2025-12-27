import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createPayment } from "../controllers/billing.controller.js";

const router = express.Router();

router.post("/pay", authenticate, createPayment);

export default router;
