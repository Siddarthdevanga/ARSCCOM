import express from "express";
import { createPaymentLink } from "../controllers/payment.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/pay", authMiddleware, createPaymentLink);

export default router;
