import { Router } from "express";
import { db } from "../config/db.js";
import { sendIntroMessage, sendTextMessage } from "../services/gupshup.service.js";

const router = Router();

const WEBHOOK_TOKEN = () => process.env.GUPSHUP_WEBHOOK_TOKEN || "";

/* --------------------------------------------------
   POST /api/whatsapp/webhook
   Gupshup sends all inbound events here.
   Always respond 200 immediately; process async.
-------------------------------------------------- */
router.post("/webhook", (req, res) => {
  const token = req.query.token || req.headers["x-gupshup-token"] || "";
  const expected = WEBHOOK_TOKEN();

  // Verify webhook token if one is configured
  if (expected && token !== expected) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.sendStatus(200); // acknowledge instantly

  // Process asynchronously — do not block Gupshup delivery
  setImmediate(() => handleInbound(req.body).catch((e) => console.error("[WA WEBHOOK ERROR]", e.message)));
});

/* --------------------------------------------------
   GET /api/whatsapp/webhook  (Gupshup verification ping)
-------------------------------------------------- */
router.get("/webhook", (req, res) => res.sendStatus(200));

async function handleInbound(body) {
  // Gupshup Smart Messaging webhook payload structure:
  // body.payload.type      — "message" | "message-event"
  // body.payload.payload   — nested message content
  // body.payload.sender.phone — sender's phone (E.164 without +)
  const payload = body?.payload;
  if (!payload) return;

  const type = payload.type;
  const phone = payload.sender?.phone;
  if (!phone) return;

  if (type === "message") {
    const msgPayload = payload.payload;
    const msgType    = msgPayload?.type; // "text" | "quick_reply" | etc.

    // Quick reply button chosen
    if (msgType === "quick_reply") {
      const buttonTitle = msgPayload?.title || msgPayload?.text || "";
      await handleButton(phone, buttonTitle);
      return;
    }

    // Plain text — treat as a new conversation; send intro
    await upsertLead(phone, null);
    await sendIntroMessage(phone);
    return;
  }

  // Ignore delivery receipts / read events
}

async function handleButton(phone, title) {
  const normalised = (title || "").trim().toLowerCase();

  if (normalised === "start with promeet") {
    await upsertLead(phone, "start_with_promeet");
    await sendTextMessage(
      phone,
      "🚀 Get started with Promeet here:\nhttps://www.promeet.zodopt.com/auth/register"
    );
    return;
  }

  if (normalised === "book a demo") {
    await upsertLead(phone, "book_a_demo");
    // Redirection handled in Gupshup dashboard — no bot reply needed
    return;
  }

  // Unknown button — send intro again
  await upsertLead(phone, null);
  await sendIntroMessage(phone);
}

async function upsertLead(phone, action) {
  try {
    await db.query(
      `INSERT INTO whatsapp_leads (phone, last_action, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         last_action = COALESCE(VALUES(last_action), last_action),
         updated_at  = NOW()`,
      [phone, action]
    );
  } catch (e) {
    console.error("[WA LEAD UPSERT]", e.message);
  }
}

export default router;
