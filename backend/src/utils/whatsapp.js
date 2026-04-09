/**
 * utils/whatsapp.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Gupshup WhatsApp API wrapper
 *
 * Required env vars:
 *   GUPSHUP_API_KEY
 *   GUPSHUP_APP_NAME
 *   GUPSHUP_SOURCE_NUMBER       e.g. "917XXXXXXXX"
 *   GUPSHUP_OTP_TEMPLATE_ID     UUID — OTP template
 *   GUPSHUP_PASS_TEMPLATE_ID    UUID — visitor pass link template
 *   GUPSHUP_APPROVAL_TEMPLATE_ID UUID — employee approval template
 *   FRONTEND_URL                e.g. "https://promeet.zodopt.com"
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ======================================================
   VALIDATE ENV ON BOOT
====================================================== */
// ca802e29-9330-4e39-8adb-f80e2e63af65  ← GUPSHUP_PASS_TEMPLATE_ID
// 4a1ca8eb-0bf5-4617-9338-fc25a483a8a3  ← GUPSHUP_APPROVAL_TEMPLATE_ID
const REQUIRED = [
  "GUPSHUP_API_KEY",
  "GUPSHUP_APP_NAME",
  "GUPSHUP_SOURCE_NUMBER",
  "GUPSHUP_OTP_TEMPLATE_ID",
  "GUPSHUP_PASS_TEMPLATE_ID",
  "GUPSHUP_APPROVAL_TEMPLATE_ID",
  "FRONTEND_URL",
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

/* ======================================================
   PHONE NORMALISATION
   Strips all non-digits, takes last 10, prepends "91".
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
====================================================== */
const postTemplate = async ({ destination, templateId, params = [] }) => {
  const apiKey    = process.env.GUPSHUP_API_KEY;
  const appName   = process.env.GUPSHUP_APP_NAME;
  const sourceNum = process.env.GUPSHUP_SOURCE_NUMBER;

  if (!apiKey || !appName || !sourceNum) {
    throw new Error("Gupshup env vars not configured");
  }

  const normalizedSource  = String(sourceNum).replace(/\D/g, "");
  const templatePayload   = JSON.stringify({ id: templateId, params });

  const body = new URLSearchParams({
    channel:     "whatsapp",
    source:      normalizedSource,
    destination: destination,
    "src.name":  appName,
    template:    templatePayload,
  });

  console.log("[WHATSAPP] Template request:", { source: normalizedSource, destination, templateId, params });

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
   SEND OTP VIA WHATSAPP
   Template body: {{1}} is your verification code. For your
   security, do not share this code. Expires in 5 minutes.
   {{1}} = OTP
====================================================== */
export const sendOtpWhatsApp = async ({ phone, otp }) => {
  const destination = normalizePhone(phone);
  const templateId  = process.env.GUPSHUP_OTP_TEMPLATE_ID;

  console.log(`[WHATSAPP][OTP] → ${destination} | OTP: ${otp}`);

  await postTemplate({ destination, templateId, params: [String(otp)] });

  console.log(`[WHATSAPP][OTP] Sent to ${destination}`);
};

/* ======================================================
   SEND VISITOR PASS LINK VIA WHATSAPP
   Template body:
     Your Digital Visitor Pass

     Welcome to {{1}}!

     Your visitor pass is ready. Please show this at reception.

     View Pass: {{2}}

     Visitor ID: {{3}}
     Name: {{4}}
     Purpose: {{5}}
     Check-in: {{6}}

     Promeet - Visitor Management Platform

   {{1}} = Company name
   {{2}} = Full pass URL
   {{3}} = Visitor code
   {{4}} = Visitor name
   {{5}} = Purpose
   {{6}} = Check-in time

   UUID: GUPSHUP_PASS_TEMPLATE_ID = ca802e29-9330-4e39-8adb-f80e2e63af65
====================================================== */
export const sendVisitorPassWhatsApp = async ({
  phone,
  company  = {},
  visitor  = {},
}) => {
  const destination  = normalizePhone(phone);
  const templateId   = process.env.GUPSHUP_PASS_TEMPLATE_ID;
  const frontendUrl  = process.env.FRONTEND_URL || "https://www.promeet.zodopt.com";

  const companyName  = company.name           || "ProMeet";
  const visitorCode  = visitor.visitorCode    || "-";
  const visitorName  = visitor.name           || "Visitor";
  const purpose      = visitor.purpose        || "Visit";
  const checkIn      = visitor.checkInDisplay || visitor.checkIn || "-";

  const passUrl = `${frontendUrl}/v/pass?code=${visitorCode}`;

  console.log(`[WHATSAPP][PASS] → ${destination} | passUrl: ${passUrl}`);

  await postTemplate({
    destination,
    templateId,
    params: [companyName, passUrl, visitorCode, visitorName, purpose, checkIn],
  });

  console.log(`[WHATSAPP][PASS] Sent to ${destination}`);
};

/* ======================================================
   SEND APPROVAL REQUEST VIA WHATSAPP (to employee)
   Template body:
     Hello! {{1}} has arrived to meet you.

     🪪 View Pass: {{2}}

     Please take action below.

     Promeet - Visitor Management Platform

   Buttons (CTA Dynamic URL):
     Button 1 — Approve Visit
       Base URL: https://www.promeet.zodopt.com/visit-response/
       Suffix param: TOKEN/accept
     Button 2 — Decline Visit
       Base URL: https://www.promeet.zodopt.com/visit-response/
       Suffix param: TOKEN/decline

   Params order (Gupshup):
     [0] = {{1}} body — visitor name
     [1] = {{2}} body — pass URL
     [2] = button 1 suffix — TOKEN/accept
     [3] = button 2 suffix — TOKEN/decline

   UUID: GUPSHUP_APPROVAL_TEMPLATE_ID = 4a1ca8eb-0bf5-4617-9338-fc25a483a8a3
====================================================== */
export const sendApprovalWhatsApp = async ({
  phone,
  visitor  = {},
  responseToken,
}) => {
  const destination  = normalizePhone(phone);
  const templateId   = process.env.GUPSHUP_APPROVAL_TEMPLATE_ID;
  const frontendUrl  = process.env.FRONTEND_URL || "https://www.promeet.zodopt.com";

  const visitorName  = visitor.name        || "A visitor";
  const visitorCode  = visitor.visitorCode || "";

  const passUrl      = `${frontendUrl}/v/pass?code=${visitorCode}`;

  // Button suffixes — appended to base URL set in Gupshup template
  const approveSuffix = `${responseToken}/accept`;
  const declineSuffix = `${responseToken}/decline`;

  console.log(`[WHATSAPP][APPROVAL] → ${destination} | visitor: ${visitorName} | token: ${responseToken}`);

  await postTemplate({
    destination,
    templateId,
    // body params first, then button suffix params in button order
    params: [visitorName, passUrl, approveSuffix, declineSuffix],
  });

  console.log(`[WHATSAPP][APPROVAL] Sent to ${destination}`);
};
