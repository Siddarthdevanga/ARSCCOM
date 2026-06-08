import { Router } from "express";
import { db } from "../config/db.js";
import { sendIntroMessage, sendTextMessage } from "../services/gupshup.service.js";

const router = Router();

/* --------------------------------------------------
   POST /api/whatsapp/webhook
   Gupshup sends all inbound events here.
   Always respond 200 immediately; process async.
-------------------------------------------------- */
router.post("/webhook", (req, res) => {
  console.log("[WA WEBHOOK] Inbound:", JSON.stringify(req.body));
  res.sendStatus(200); // acknowledge instantly

  // Process asynchronously — do not block Gupshup delivery
  setImmediate(() => handleInbound(req.body).catch((e) => console.error("[WA WEBHOOK ERROR]", e.message)));
});

/* --------------------------------------------------
   GET /api/whatsapp/webhook  (Gupshup verification ping)
-------------------------------------------------- */
router.get("/webhook", (_req, res) => res.sendStatus(200));

async function handleInbound(body) {
  // Gupshup Smart Messaging v2 payload:
  // body.payload.type           — "message" | "message-event"
  // body.payload.payload.type   — "text" | "quick_reply" | etc.
  // body.payload.sender.phone   — sender's phone (E.164 without +)
  const payload = body?.payload;
  if (!payload) {
    console.log("[WA] No payload found in body, skipping");
    return;
  }

  const type  = payload.type;
  const phone = payload.sender?.phone;
  console.log(`[WA] type=${type} phone=${phone}`);

  if (!phone) {
    console.log("[WA] No phone found, skipping");
    return;
  }

  if (type === "message") {
    const msgPayload = payload.payload;
    const msgType    = msgPayload?.type;
    console.log(`[WA] msgType=${msgType}`);

    if (msgType === "quick_reply") {
      const buttonTitle = msgPayload?.title || msgPayload?.text || "";
      console.log(`[WA] Button pressed: "${buttonTitle}"`);
      await handleButton(phone, buttonTitle);
      return;
    }

    // Any plain text message — send intro with buttons
    console.log(`[WA] Text message from ${phone}, sending intro`);
    await upsertLead(phone, null);
    await sendIntroMessage(phone);
    return;
  }

  console.log(`[WA] Ignoring event type: ${type}`);
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
    // Redirect configured in Gupshup dashboard — no bot reply needed
    return;
  }

  // Unknown input — re-send intro
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
