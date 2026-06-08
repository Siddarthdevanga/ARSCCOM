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
  // Actual Gupshup v2 structure:
  // body.type              — "message" | "message-event" (event kind)
  // body.payload.type      — "text" | "quick_reply" | etc. (message content type)
  // body.payload.sender.phone — sender phone (E.164 without +)
  const eventType = body?.type;
  const payload   = body?.payload;

  if (!payload) {
    console.log("[WA] No payload found in body, skipping");
    return;
  }

  const msgType = payload.type;
  const phone   = payload.sender?.phone;
  const name    = payload.sender?.name || null;
  console.log(`[WA] eventType=${eventType} msgType=${msgType} phone=${phone}`);

  if (!phone) {
    console.log("[WA] No phone found, skipping");
    return;
  }

  if (eventType !== "message") {
    console.log(`[WA] Ignoring non-message event: ${eventType}`);
    return;
  }

  // Button click — gupshup.ai sends type "button", "quick_reply", or "interactive"
  if (msgType === "quick_reply" || msgType === "button" || msgType === "button_reply" || msgType === "interactive") {
    const inner = payload.payload || {};
    const buttonTitle =
      inner.title ||
      inner.text  ||
      inner.button_reply?.title ||
      "";
    console.log(`[WA] Button pressed: "${buttonTitle}" (msgType=${msgType})`);
    await handleButton(phone, buttonTitle, name);
    return;
  }

  // text, image, audio, or any other — send intro
  console.log(`[WA] Inbound message from ${phone}, sending intro`);
  await upsertLead(phone, name, null);
  await sendIntroMessage(phone);
}

async function handleButton(phone, title, name) {
  const normalised = (title || "").trim().toLowerCase();

  if (normalised === "start with promeet") {
    // CTA template: URL opens directly, no bot reply needed
    await upsertLead(phone, name, "start_with_promeet");
    return;
  }

  if (normalised === "book a demo") {
    // CTA template: URL opens directly, no bot reply needed
    await upsertLead(phone, name, "book_a_demo");
    return;
  }

  // Unknown input — re-send intro
  await upsertLead(phone, name, null);
  await sendIntroMessage(phone);
}

async function upsertLead(phone, name, action) {
  try {
    await db.query(
      `INSERT INTO whatsapp_leads (phone, name, last_action, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         name        = COALESCE(VALUES(name), name),
         last_action = COALESCE(VALUES(last_action), last_action),
         updated_at  = NOW()`,
      [phone, name, action]
    );
  } catch (e) {
    console.error("[WA LEAD UPSERT]", e.message);
  }
}

export default router;
