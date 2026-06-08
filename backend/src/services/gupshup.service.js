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
