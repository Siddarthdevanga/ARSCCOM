import express from "express";
import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();

const WEBHOOK_KEY = process.env.ZOHO_WEBHOOK_KEY || "PROMEET_WEBHOOK_KEY";

/* ======================================================
   COMMON EMAIL FOOTER
====================================================== */
const emailFooter = () => `
<br/>
Regards,<br/>
<b style="color:#6c2bd9">PROMEET</b><br/>

<img src="/logo.png" height="55" />

<hr/>
<p style="font-size:13px;color:#666">
This email was automatically sent from the PROMEET Subscription and Billing System.
If you did not perform this action, please contact your administrator immediately.
</p>
`;

/* ======================================================
   ZOHO WEBHOOK
====================================================== */
router.post("/", async (req, res) => {
  try {
    /* ================= SECURITY ================= */
    const key = req.headers["x-webhook-key"];
    if (!key || key !== WEBHOOK_KEY) {
      console.log("❌ INVALID WEBHOOK KEY");
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    const event = req.body?.event_type;
    const payload = req.body?.data;

    if (!payload) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    console.log("🔔 ZOHO EVENT:", event);

    const subscription = payload.subscription || {};
    const customer = payload.customer || subscription.customer || {};

    const zohoSubscriptionId = subscription?.subscription_id;
    const zohoCustomerId =
      customer?.customer_id || subscription?.customer_id;

    if (!zohoCustomerId) {
      console.log("❌ Missing Zoho Customer ID");
      return res.status(400).json({ message: "No customer id" });
    }

    const email =
      customer?.email ||
      subscription?.customer?.email ||
      null;

    const companyName =
      customer?.display_name ||
      subscription?.customer?.display_name ||
      "Your Company";

    const newStatus =
      subscription?.status ||
      subscription?.subscription_status ||
      null;

    if (!newStatus) {
      console.log("⚠️ No subscription status received");
      return res.json({ message: "Ignored - no status" });
    }

    /* ================= FETCH COMPANY ================= */
    const [[company]] = await db.query(
      `SELECT id, subscription_status, plan 
       FROM companies 
       WHERE zoho_customer_id=? 
       LIMIT 1`,
      [zohoCustomerId]
    );

    if (!company) {
      console.log("❌ Company not found for webhook!");
      return res.json({ message: "Company not found" });
    }

    const oldStatus = company.subscription_status;

    /* ================= IGNORE NO CHANGE ================= */
    if (oldStatus === newStatus) {
      console.log(`ℹ️ No status change (${oldStatus}) → ignoring`);
      return res.json({ message: "No change" });
    }

    /* ================= UPDATE DB ================= */
    await db.query(
      `
      UPDATE companies SET
        subscription_status=?,
        plan = CASE 
          WHEN ? = 'trial' THEN 'trial'
          WHEN ? = 'active' THEN 'business'
          ELSE plan
        END,
        zoho_subscription_id=?
      WHERE zoho_customer_id=?
      `,
      [newStatus, newStatus, newStatus, zohoSubscriptionId, zohoCustomerId]
    );

    console.log(`✅ STATUS UPDATED: ${oldStatus} → ${newStatus}`);

    /* ================= NOTIFICATION EMAILS ================= */
    if (email) {
      if (newStatus === "trial") {
        console.log("📧 Sending Trial Email");
        await sendEmail({
          to: email,
          subject: "PROMEET Trial Subscription Activated",
          html: `
<p>Hello,</p>

<p>
We are pleased to inform you that the trial subscription for 
<b style="color:#6c2bd9">${companyName}</b> has been successfully activated.
</p>

<p>
You now have access to PROMEET features during the trial period.
Feel free to explore and experience the platform.
</p>

${emailFooter()}
`
        });
      }

      if (newStatus === "active") {
        console.log("📧 Sending Activation Email");
        await sendEmail({
          to: email,
          subject: "PROMEET Subscription Activated",
          html: `
<p>Hello,</p>

<p>
We are pleased to inform you that the business subscription for 
<b style="color:#6c2bd9">${companyName}</b> has been successfully activated.
</p>

<p>
Your organization can now fully utilize all PROMEET services without restrictions.
</p>

${emailFooter()}
`
        });
      }

      if (newStatus === "cancelled") {
        console.log("📧 Sending Cancellation Email");
        await sendEmail({
          to: email,
          subject: "PROMEET Subscription Cancelled",
          html: `
<p>Hello,</p>

<p>
We would like to inform you that the subscription for 
<b style="color:#6c2bd9">${companyName}</b> has been cancelled.
</p>

<p>
If this cancellation was not intended, kindly contact support for assistance.
</p>

${emailFooter()}
`
        });
      }
    } else {
      console.log("⚠️ No email found — skipping email send");
    }

    res.json({ message: "Webhook processed" });
  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    res.status(500).json({ message: "Webhook failed" });
  }
});

export default router;
