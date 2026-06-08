import axios from "axios";

// Separate config for the Promeet bot app.
// Existing OTP/pass secrets (GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER)
// are untouched — this service uses the BOT_ prefixed vars only.
const getConfig = () => {
  const cfg = {
    apiKey  : process.env.GUPSHUP_BOT_API_KEY        || "",
    appName : process.env.GUPSHUP_BOT_APP_NAME       || "",
    srcNum  : process.env.GUPSHUP_BOT_SOURCE_NUMBER  || "",
  };
  console.log(`[WA CONFIG] appName="${cfg.appName}" srcNum="${cfg.srcNum}" apiKey="${cfg.apiKey ? cfg.apiKey.slice(0,6) + "…" : "MISSING"}"`);
  return cfg;
};

const API_URL = "https://api.gupshup.io/wa/api/v1/msg";

const INTRO_TEXT =
  "*Welcome to Promeet!*\n\n" +
  "Thank you for your interest in Promeet.\n" +
  "✨ Manage visitor check-ins, visitor records, and visitor history digitally.\n" +
  "✨ Track visitor details, photos, meeting hosts, and items carried.\n" +
  "✨ Get real-time visibility of checked-in/check-out visitors with detailed analytics.\n" +
  "✨ Book and manage meeting & conference rooms efficiently from a single platform.\n\n" +
  "What would you like to do?";

export const sendIntroMessage = async (destination) => {
  const { apiKey, appName, srcNum } = getConfig();

  const message = JSON.stringify({
    type: "quick_reply",
    msgid: `intro_${Date.now()}`,
    content: {
      type: "text",
      text: INTRO_TEXT,
      header: "Promeet",
    },
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
    const { data } = await axios.post(API_URL, params.toString(), {
      headers: {
        apikey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
    const { data } = await axios.post(API_URL, params.toString(), {
      headers: {
        apikey: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    console.log("[WA] sendTextMessage response:", JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("[WA] sendTextMessage failed:", err.response?.status, JSON.stringify(err.response?.data));
    throw err;
  }
};
