import axios from "axios";

// Separate config for the Promeet bot app.
// Existing OTP/pass secrets (GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER)
// are untouched — this service uses the BOT_ prefixed vars only.
const getConfig = () => {
  const cfg = {
    apiKey       : process.env.GUPSHUP_BOT_API_KEY           || "",
    appName      : process.env.GUPSHUP_BOT_APP_NAME          || "",
    srcNum       : process.env.GUPSHUP_BOT_SOURCE_NUMBER     || "",
    introTemplate: process.env.GUPSHUP_BOT_INTRO_TEMPLATE    || "",
  };
  return cfg;
};

const MSG_URL      = "https://api.gupshup.io/wa/api/v1/msg";
const TEMPLATE_URL = "https://api.gupshup.io/wa/api/v1/template/msg";
const OPTIN_URL    = "https://api.gupshup.io/sm/api/v1/app/opt/in";

/* Register a phone number as opted-in for marketing messages */
export const registerOptIn = async (phone) => {
  const { appName } = getConfig();
  const botApiKey  = process.env.GUPSHUP_BOT_API_KEY || "";
  const mainApiKey = process.env.GUPSHUP_API_KEY || "";

  // Try bot API key first, then fall back to main API key
  for (const [label, apiKey] of [["BOT", botApiKey], ["MAIN", mainApiKey]]) {
    if (!apiKey) continue;
    try {
      const body = new URLSearchParams({ user: phone, optInSource: "WEB_FORM" });
      console.log(`[WA-OPTIN] trying ${label} key for appName="${appName}" phone=${phone}`);
      const { data } = await axios.post(`${OPTIN_URL}/${encodeURIComponent(appName)}`, body.toString(), {
        headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      });
      console.log(`[WA-OPTIN] success (${label}) for ${phone}:`, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error(`[WA-OPTIN] failed (${label}) for ${phone}:`, err.response?.status, JSON.stringify(err.response?.data));
    }
  }
};

/* --------------------------------------------------
   Generic template sender — used for demo confirmation
   and reminder messages.
   params: string[]  maps to {{1}}, {{2}}, {{3}} …
-------------------------------------------------- */
export const sendWhatsAppTemplate = async (destination, templateName, params = []) => {
  const { apiKey, appName, srcNum } = getConfig();

  const template = JSON.stringify({ id: templateName, params });
  const body = new URLSearchParams({
    channel: "whatsapp",
    source: srcNum,
    destination,
    "src.name": appName,
    template,
  });

  try {
    const { data } = await axios.post(TEMPLATE_URL, body.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log(`[WA] template "${templateName}" → ${destination}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[WA] template "${templateName}" failed:`, err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};

const INTRO_TEXT =
  "*Welcome to Promeet!*\n\n" +
  "Thank you for your interest in Promeet.\n" +
  "✨ Manage visitor check-ins, visitor records, and visitor history digitally.\n" +
  "✨ Track visitor details, photos, meeting hosts, and items carried.\n" +
  "✨ Get real-time visibility of checked-in/check-out visitors with detailed analytics.\n" +
  "✨ Book and manage meeting & conference rooms efficiently from a single platform.";

/* --------------------------------------------------
   Send intro — uses approved CTA-URL template if
   GUPSHUP_BOT_INTRO_TEMPLATE is set, otherwise falls
   back to quick_reply buttons (useful during testing
   before the template is approved).
-------------------------------------------------- */
export const sendIntroMessage = async (destination) => {
  const { apiKey, appName, srcNum, introTemplate } = getConfig();

  if (introTemplate) {
    // Template with CTA URL buttons — direct URL redirect on click, no bot reply needed
    const template = JSON.stringify({ id: introTemplate, params: [] });
    const params = new URLSearchParams({
      channel: "whatsapp",
      source: srcNum,
      destination,
      "src.name": appName,
      template,
    });
    try {
      const { data } = await axios.post(TEMPLATE_URL, params.toString(), {
        headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      });
      console.log("[WA] sendIntroTemplate response:", JSON.stringify(data));
      return data;
    } catch (err) {
      console.error("[WA] sendIntroTemplate failed:", err.response?.status, JSON.stringify(err.response?.data));
      throw err;
    }
  }

  // Fallback: quick_reply buttons (no URL redirect, used before template is approved)
  const message = JSON.stringify({
    type: "quick_reply",
    msgid: `intro_${Date.now()}`,
    content: { type: "text", text: INTRO_TEXT + "\n\nWhat would you like to do?" },
    options: [
      { type: "text", title: "Book A Demo" },
      { type: "text", title: "Start With Promeet" },
    ],
  });

  const params = new URLSearchParams({
    channel: "whatsapp",
    source: srcNum,
    destination,
    "src.name": appName,
    message,
  });

  try {
    const { data } = await axios.post(MSG_URL, params.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("[WA] sendIntroMessage response:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("[WA] sendIntroMessage failed:", err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};

/* --------------------------------------------------
   Send image template — marketing bot app
   Template must have IMAGE header + {{1}} body.
   imageUrl: publicly accessible image URL (JPEG/PNG).
-------------------------------------------------- */
export const sendImageWhatsApp = async (destination, imageUrl, bodyText) => {
  const { apiKey, appName, srcNum } = getConfig();

  const message = JSON.stringify({
    type:        "image",
    originalUrl: imageUrl,
    previewUrl:  imageUrl,
    caption:     bodyText,
  });

  const body = new URLSearchParams({
    channel:    "whatsapp",
    source:     srcNum,
    destination,
    "src.name": appName,
    message,
  });

  console.log(`[WA-IMG] dest=${destination} imageUrl=${imageUrl}`);

  try {
    const { data } = await axios.post(MSG_URL, body.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log(`[WA] image msg → ${destination}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[WA] image msg failed for ${destination}:`, err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};

export const sendVideoWhatsApp = async (destination, videoUrl, bodyText) => {
  const { apiKey, appName, srcNum } = getConfig();

  const message = JSON.stringify({
    type:    "video",
    url:     videoUrl,
    caption: bodyText,
  });

  const body = new URLSearchParams({
    channel:    "whatsapp",
    source:     srcNum,
    destination,
    "src.name": appName,
    message,
  });

  console.log(`[WA-VID] dest=${destination} videoUrl=${videoUrl}`);

  try {
    const { data } = await axios.post(MSG_URL, body.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log(`[WA] video msg → ${destination}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[WA] video msg failed for ${destination}:`, err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};

/* --------------------------------------------------
   Payment Nurture — interactive quick_reply messages
   Msg 1 (5h), Msg 2 (24h), Msg 3 (3d) after pending payment.
   Session messages: work best within 24h of last bot interaction.
-------------------------------------------------- */
const PAYMENT_NURTURE_TEXTS = [
  `Hi {name}! 👋 We noticed you started your Promeet journey but haven't completed your payment yet.\n\nYour workspace is almost ready! Complete your payment to unlock:\n✅ Smart Visitor Management\n✅ Conference Room Booking\n✅ Real-time Analytics\n\nLogin to complete: https://myappz.ai/auth/login`,
  `Hi {name}! 😊 Still thinking about Promeet?\n\nBusinesses like yours save hours every week with smart visitor & conference management. Your team deserves better tools!\n\nDon't let your account sit idle — complete your payment today.\n\nLogin: https://myappz.ai/auth/login`,
  `Hi {name}! 🙏 Final reminder from us.\n\nYour Promeet account is ready and waiting. Hundreds of businesses trust Promeet to manage visitors and conference rooms effortlessly.\n\nComplete your payment now — takes less than 2 minutes.\n\nLogin: https://myappz.ai/auth/login`,
];

export const sendPaymentNurtureMessage = async (destination, name, msgNum) => {
  const { apiKey, appName, srcNum } = getConfig();
  const text = PAYMENT_NURTURE_TEXTS[msgNum - 1].replace("{name}", name || "there");
  const message = JSON.stringify({
    type:    "quick_reply",
    msgid:   `pay_nurture_${msgNum}_${Date.now()}`,
    content: { type: "text", text },
    options: [
      { type: "text", title: "Complete Payment" },
      { type: "text", title: "Book a Demo" },
    ],
  });
  const params = new URLSearchParams({
    channel:    "whatsapp",
    source:     srcNum,
    destination,
    "src.name": appName,
    message,
  });
  try {
    const { data } = await axios.post(MSG_URL, params.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log(`[WA] payNurture Msg${msgNum} → ${destination}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[WA] payNurture Msg${msgNum} failed for ${destination}:`, err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};

export const sendTextMessage = async (destination, text) => {
  const { apiKey, appName, srcNum } = getConfig();

  const message = JSON.stringify({ type: "text", text });

  const params = new URLSearchParams({
    channel: "whatsapp",
    source: srcNum,
    destination,
    "src.name": appName,
    message,
  });

  try {
    const { data } = await axios.post(MSG_URL, params.toString(), {
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("[WA] sendTextMessage response:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("[WA] sendTextMessage failed:", err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};
