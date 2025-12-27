import express from "express";
import { zohoWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();
router.post("/zoho", zohoWebhook);

export default router;
