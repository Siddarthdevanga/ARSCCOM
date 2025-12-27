import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

router.post("/zoho/payment", async (req, res) => {
  try {
    const event = req.body;
    const customerId = event?.data?.customer_id;
    const subscriptionId = event?.data?.subscription_id;

    if (!customerId) return res.status(200).end();

    await db.query(
      `UPDATE companies 
       SET subscription_status='active',
           zoho_subscription_id=?
       WHERE zoho_customer_id=?`,
      [subscriptionId, customerId]
    );

    res.status(200).end();
  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    res.status(200).end();
  }
});

export default router;
