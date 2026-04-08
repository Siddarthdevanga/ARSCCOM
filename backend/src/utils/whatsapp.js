/**
 * utils/whatsapp.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gupshup WhatsApp API wrapper
 *
 * Handles:
 *   1. Phone normalisation     → always "91XXXXXXXXXX" (10-digit, no +)
 *   2. sendOtpWhatsApp         → sends approved OTP template
 *   3. sendVisitorPassWhatsApp → sends PNG buffer directly to Gupshup
 *                                (NO public URL / S3 policy required)
 *
 * Required env vars (store in AWS Secrets Manager / .env):
 *   GUPSHUP_API_KEY
 *   GUPSHUP_APP_NAME
 *   GUPSHUP_SOURCE_NUMBER      e.g. "917XXXXXXXX"  (91 + 10 digits, no +)
 *   GUPSHUP_OTP_TEMPLATE_ID    template UUID from Gupshup dashboard
 *   GUPSHUP_PASS_TEMPLATE_ID   template UUID from Gupshup dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */


/* ======================================================
   VALIDATE ENV ON BOOT
====================================================== */
const REQUIRED = [
  "GUPSHUP_API_KEY",
  "GUPSHUP_APP_NAME",
  "GUPSHUP_SOURCE_NUMBER",
  "GUPSHUP_OTP_TEMPLATE_ID",     // Template UUID from Gupshup dashboard
  "GUPSHUP_PASS_TEMPLATE_ID",    // Template UUID from Gupshup dashboard
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.warn(`⚠️  [WHATSAPP] Missing env: ${key} — WhatsApp notifications will be skipped.`);
  }
}

/* ======================================================
   CONSTANTS
====================================================== */
const GUPSHUP_TEMPLATE_API = "https://api.gupshup.io/wa/api/v1/template/msg";
const GUPSHUP_MSG_API       = "https://api.gupshup.io/wa/api/v1/msg";

/* ======================================================
   PHONE NORMALISATION
   Strips all non-digits, takes last 10, prepends "91".
   Accepts: +91XXXXXXXXXX / 91XXXXXXXXXX / 0XXXXXXXXXX / XXXXXXXXXX
====================================================== */
export const normalizePhone = (raw) => {
  if (!raw) throw new Error("Phone number is required");
  const digits = String(raw).replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) {
    throw new Error(`Invalid phone: "${raw}" — could not extract 10 digits`);
  }
  return `91${last10}`;
};

/* ======================================================
   INTERNAL: POST TEMPLATE MESSAGE
   Matches working Postman format:
     POST /wa/api/v1/template/msg
     channel=whatsapp&source=...&destination=...&src.name=...
     &template={"id":"<uuid>","params":["val1","val2",...]}
====================================================== */
const postTemplate = async ({ destination, templateId, params = [] }) => {
  const apiKey    = process.env.GUPSHUP_API_KEY;
  const appName   = process.env.GUPSHUP_APP_NAME;
  const sourceNum = process.env.GUPSHUP_SOURCE_NUMBER;

  if (!apiKey || !appName || !sourceNum) {
    console.error("[WHATSAPP] Missing Gupshup configuration:", {
      hasApiKey: !!apiKey,
      hasAppName: !!appName,
      hasSourceNum: !!sourceNum,
    });
    throw new Error("Gupshup env vars not configured");
  }

  const normalizedSource = String(sourceNum).replace(/\D/g, "");

  const templatePayload = JSON.stringify({ id: templateId, params });

  const body = new URLSearchParams({
    channel:     "whatsapp",
    source:      normalizedSource,
    destination: destination,
    "src.name":  appName,
    template:    templatePayload,
  });

  console.log("[WHATSAPP] Template request:", {
    source: normalizedSource,
    destination,
    templateId,
    params,
  });

  const response = await fetch(GUPSHUP_TEMPLATE_API, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "apikey":        apiKey,
    },
    body: body.toString(),
  });

  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!response.ok) {
    console.error("[WHATSAPP] API error:", response.status, json);
    throw new Error(`Gupshup API error ${response.status}: ${JSON.stringify(json)}`);
  }

  console.log("[WHATSAPP] API response:", json);
  return json;
};

/* ======================================================
   INTERNAL: SEND BINARY IMAGE (multipart/form-data)

   Gupshup's /wa/api/v1/msg accepts a raw file buffer via multipart.
   The image is uploaded directly — no hosted URL needed.

   The visitor receives the actual PNG image in their WhatsApp chat.
====================================================== */
const postBinaryImage = async ({ destination, imageBuffer, filename, caption }) => {
  const apiKey    = process.env.GUPSHUP_API_KEY;
  const appName   = process.env.GUPSHUP_APP_NAME;
  const sourceNum = process.env.GUPSHUP_SOURCE_NUMBER;

  if (!apiKey || !appName || !sourceNum) {
    throw new Error("Gupshup env vars not configured");
  }

  const normalizedSource = String(sourceNum).replace(/\D/g, "");

  // Use native FormData + Blob — native fetch sets the correct
  // multipart/form-data Content-Type boundary automatically.
  const form = new FormData();
  form.append("channel",     "whatsapp");
  form.append("source",      normalizedSource);
  form.append("destination", destination);
  form.append("src.name",    appName);
  form.append("message",     JSON.stringify({ type: "image", caption: caption || "" }));
  form.append("file",        new Blob([imageBuffer], { type: "image/png" }), filename || "visitor-pass.png");

  const response = await fetch(GUPSHUP_MSG_API, {
    method:  "POST",
    headers: { "apikey": apiKey },  // No Content-Type — fetch sets it with the correct boundary
    body:    form,
  });

  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!response.ok) {
    console.error("[WHATSAPP] Media API error:", response.status, json);
    throw new Error(`Gupshup media error ${response.status}: ${JSON.stringify(json)}`);
  }

  console.log("[WHATSAPP] Media response:", json);
  return json;
};

/* ======================================================
   SEND OTP VIA WHATSAPP (META CLOUD API FORMAT)
   ─────────────────────────────────────────────────────
   Template: verification_otp
   Category: AUTHENTICATION
   Language: English UK (en_GB)

   Register this exact body in Gupshup dashboard:
   ────────────────────────────────────────────────
   {{1}} is your verification code. For your security,
   do not share this code.
   Expires in 5 minutes.
   ────────────────────────────────────────────────
   {{1}} = 6-digit OTP

   AWS Secrets Manager:
   GUPSHUP_OTP_TEMPLATE_ID = "verification_otp" (template NAME, not UUID)
====================================================== */
export const sendOtpWhatsApp = async ({ phone, otp }) => {
  const destination = normalizePhone(phone);
  const templateName = process.env.GUPSHUP_OTP_TEMPLATE_ID;

  console.log(`[WHATSAPP][OTP] → ${destination} | OTP: ${otp} | template: ${templateName}`);

  await postTemplate({
    destination,
    templateId: templateName,
    params: [String(otp)],  // {{1}} = OTP
  });

  console.log(`[WHATSAPP][OTP] Sent to ${destination}`);
};

/* ======================================================
   SEND VISITOR PASS VIA WHATSAPP (DIRECT BINARY IMAGE)
   ─────────────────────────────────────────────────────
   Template: visitor_pass
   Category: MARKETING or UTILITY
   Language: English UK (en_GB)

   What the visitor receives (two messages in sequence):

   Message 1 — The actual PNG pass image
     Sent as a binary file upload via Gupshup's media API.
     Visitor sees the full visitor pass card as an image in chat.
     Caption: "🎫 Your Visitor Pass — <CompanyName>"

   Message 2 — Structured text details (template)
     Register this exact body in Gupshup dashboard:
     ─────────────────────────────────────────────────────────────────
     Welcome to {{1}}! 🎉

     Your visitor pass has been sent as an image above.

     🪪 Visitor ID: {{2}}
     👤 Name: {{3}}
     📞 Phone: {{4}}
     🤝 Meeting: {{5}}
     🕐 Check-in: {{6}}

     Please show the pass image at the reception counter.
     ─────────────────────────────────────────────────────────────────
     {{1}} = Company name
     {{2}} = Visitor code
     {{3}} = Visitor name
     {{4}} = Visitor phone
     {{5}} = Person to meet
     {{6}} = Check-in time

   passImageBuffer: Buffer — output of generateVisitorPassImage()
   No S3 public URL or bucket policy change required.
====================================================== */
export const sendVisitorPassWhatsApp = async ({
  phone,
  passImageBuffer,
  company  = {},
  visitor  = {},
}) => {
  const destination = normalizePhone(phone);
  const templateId  = process.env.GUPSHUP_PASS_TEMPLATE_ID;
  const companyName = company.name || "ProMeet";

  const visitorCode  = visitor.visitorCode  || "-";
  const visitorName  = visitor.name         || "Visitor";
  const visitorPhone = visitor.phone        || "-";
  const personToMeet = visitor.personToMeet || "Reception";
  const checkIn      = visitor.checkInDisplay || visitor.checkIn || "-";

  if (!passImageBuffer || !Buffer.isBuffer(passImageBuffer)) {
    throw new Error(
      `passImageBuffer must be a Buffer — received: ${typeof passImageBuffer}`
    );
  }

  console.log(
    `[WHATSAPP][PASS] → ${destination} | buffer: ${passImageBuffer.length} bytes`
  );

  // ── Message 1: Send the PNG image directly as binary ──
  await postBinaryImage({
    destination,
    imageBuffer: passImageBuffer,
    filename:    `${visitorCode}-visitor-pass.png`,
    caption:     `🎫 Your Visitor Pass — ${companyName}`,
  });

  console.log(`[WHATSAPP][PASS] Image sent to ${destination}`);

  // ── Message 2: Send structured details as approved template ──
  await postTemplate({
    destination,
    templateId,
    params: [companyName, visitorCode, visitorName, visitorPhone, personToMeet, checkIn],
  });

  console.log(`[WHATSAPP][PASS] Details template sent to ${destination}`);
};
