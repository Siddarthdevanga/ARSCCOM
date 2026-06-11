import { Router } from "express";
import { db } from "../config/db.js";
import { sendIntroMessage, sendTextMessage, sendWhatsAppTemplate, registerOptIn } from "../services/gupshup.service.js";

async function ensureOptIn(phone) {
  const [rows] = await db.query(`SELECT optin_registered_at FROM whatsapp_leads WHERE phone = ?`, [phone]);
  if (rows.length && rows[0].optin_registered_at) return; // already registered
  await registerOptIn(phone);
  await db.query(`UPDATE whatsapp_leads SET optin_registered_at = NOW() WHERE phone = ?`, [phone]);
}

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

/* --------------------------------------------------
   POST /api/whatsapp/appointment
   Called by external booking system when a demo is booked.
   Saves the appointment and sends WhatsApp confirmation.
-------------------------------------------------- */
router.post("/appointment", async (req, res) => {
  res.sendStatus(200); // acknowledge immediately

  setImmediate(() => handleAppointment(req.body).catch((e) =>
    console.error("[APPOINTMENT ERROR]", e.message)
  ));
});

async function handleAppointment(body) {
  console.log("[APPOINTMENT] Raw payload:", JSON.stringify(body));

  // Accept multiple possible field name variants from different booking systems
  const name     = body?.name      || body?.full_name    || body?.customer_name || "";
  const email    = body?.email     || body?.email_address || "";
  const rawPhone = body?.phone     || body?.mobile        || body?.phone_number  || body?.contact || "";
  const appDate  = body?.app_date  || body?.appointment_date || body?.date || body?.booking_date || "";
  const appTime  = body?.app_time  || body?.appointment_time || body?.time || body?.booking_time || "";

  if (!rawPhone || !appDate || !appTime) {
    console.warn("[APPOINTMENT] Missing required fields:", { rawPhone, appDate, appTime });
    console.warn("[APPOINTMENT] Full body keys:", Object.keys(body || {}));
    return;
  }

  // Reject unresolved template variables (e.g. {%calendar.appointment_date%})
  if (/\{%.*%\}/.test(appDate) || /\{%.*%\}/.test(appTime)) {
    console.warn("[APPOINTMENT] Unresolved template variable in date/time — check external system field mapping:", { appDate, appTime });
    return;
  }

  // Normalise phone — strip non-digits, ensure starts with country code
  const phone = rawPhone.replace(/\D/g, "");

  // Parse date for storage
  // Priority: YYYY-MM-DD → DD/MM/YYYY → DD-MM-YYYY → fallback new Date()
  let dateISO = appDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appDate)) {
    const ddmm = appDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmm) {
      // Treat as DD/MM/YYYY (Indian format)
      dateISO = `${ddmm[3]}-${String(ddmm[2]).padStart(2,"0")}-${String(ddmm[1]).padStart(2,"0")}`;
    } else {
      const parsed = new Date(appDate);
      if (!isNaN(parsed)) dateISO = parsed.toISOString().split("T")[0];
    }
  }

  // Normalise time to HH:MM:SS
  // Handles: "14:30", "14:30:00", "2:30 PM", "10:00am", "12:00pm"
  const parseTime = (raw) => {
    const s = String(raw).trim();
    // Already HH:MM:SS
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
    // HH:MM
    if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
    // 12-hour with am/pm (e.g. "10:00am", "2:30 PM", "12:00pm")
    const match = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2];
      const period = match[3].toLowerCase();
      if (period === "am" && h === 12) h = 0;
      if (period === "pm" && h !== 12) h += 12;
      return `${String(h).padStart(2,"0")}:${m}:00`;
    }
    return s; // return as-is, let DB validate
  };
  const timeNorm = parseTime(appTime);

  // Human-readable date for WhatsApp message
  const prettyDate = new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Pretty time: "14:30:00" → "2:30 PM"
  const [hh, mm] = timeNorm.split(":").map(Number);
  const period   = hh >= 12 ? "PM" : "AM";
  const hour     = hh % 12 || 12;
  const prettyTime = `${hour}:${String(mm).padStart(2, "0")} ${period}`;

  try {
    await db.query(
      `INSERT INTO demo_appointments (name, email, phone, app_date, app_time)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, phone, dateISO, timeNorm]
    );
    console.log(`[APPOINTMENT] Saved: ${name} | ${phone} | ${dateISO} ${timeNorm}`);
  } catch (e) {
    console.error("[APPOINTMENT] DB save failed:", e.message);
    return;
  }

  // Send WhatsApp confirmation template
  const confirmTemplate = process.env.GUPSHUP_DEMO_CONFIRM_TEMPLATE || "";
  if (!confirmTemplate) {
    console.warn("[APPOINTMENT] GUPSHUP_DEMO_CONFIRM_TEMPLATE not set, skipping WhatsApp");
    return;
  }

  try {
    await sendWhatsAppTemplate(phone, confirmTemplate, [name || "there", prettyDate, prettyTime]);
    console.log(`[APPOINTMENT] Confirmation sent to ${phone}`);
  } catch (e) {
    console.error("[APPOINTMENT] Confirmation WhatsApp failed:", e.message);
  }
}

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

  // Check text for unsubscribe
  const rawText = (payload.payload?.text || payload.payload?.content?.text || "").trim().toLowerCase();
  if (rawText === "unsubscribe") {
    await handleUnsubscribe(phone);
    return;
  }

  // Any inbound message = consent — register opt-in once if not already done
  ensureOptIn(phone).catch(() => {});

  // text, image, audio, or any other — send intro
  console.log(`[WA] Inbound message from ${phone}, sending intro`);
  await upsertLead(phone, name, null);
  await sendIntroMessage(phone);
}

async function handleButton(phone, title, name) {
  ensureOptIn(phone).catch(() => {});
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

  if (normalised === "unsubscribe") {
    await handleUnsubscribe(phone);
    return;
  }

  // Unknown input — re-send intro
  await upsertLead(phone, name, null);
  await sendIntroMessage(phone);
}

async function handleUnsubscribe(phone) {
  try {
    await db.query(`UPDATE whatsapp_leads SET unsubscribed = 1 WHERE phone = ?`, [phone]);
    await sendTextMessage(phone, "You have been unsubscribed from Promeet communications. You can always reach out to us whenever you're ready. 🙏");
    console.log(`[WA] Unsubscribed: ${phone}`);
  } catch (e) {
    console.error("[WA UNSUBSCRIBE ERROR]", e.message);
  }
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
