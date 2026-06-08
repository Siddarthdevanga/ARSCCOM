import axios from "axios";

// Separate config for the Promeet bot app.
// Existing OTP/pass secrets (GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER)
// are untouched — this service uses the BOT_ prefixed vars only.
let _cfg = null;

const getConfig = () => {
  if (!_cfg) {
    _cfg = {
      apiKey  : process.env.GUPSHUP_BOT_API_KEY        || "",
      appName : process.env.GUPSHUP_BOT_APP_NAME       || "",
      srcNum  : process.env.GUPSHUP_BOT_SOURCE_NUMBER  || "",
      baseUrl : "https://api.gupshup.io",
    };
  }
  return _cfg;
};

const INTRO_TEXT =
  "👋 Welcome to *Promeet* — the smart conference room booking platform!\n\n" +
  "Promeet helps teams book meeting rooms effortlessly, manage schedules, and stay organised — all in one place.\n\n" +
  "What would you like to do?";

export const sendIntroMessage = async (destination) => {
  const { apiKey, appName, srcNum, baseUrl } = getConfig();

  const message = JSON.stringify({
    type: "quick_reply",
    msgid: `intro_${Date.now()}`,
    content: {
      type: "text",
      text: INTRO_TEXT,
      header: "Promeet",
    },
    options: [
      { type: "text", title: "Book a Demo" },
      { type: "text", title: "Start with Promeet" },
    ],
  });

  const params = new URLSearchParams({
    channel: "whatsapp",
    source: srcNum,
    destination,
    "src.name": appName,
    message,
  });

  const { data } = await axios.post(`${baseUrl}/sm/api/v1/msg`, params.toString(), {
    headers: {
      apikey: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return data;
};

export const sendTextMessage = async (destination, text) => {
  const { apiKey, appName, srcNum, baseUrl } = getConfig();

  const message = JSON.stringify({ type: "text", text });

  const params = new URLSearchParams({
    channel: "whatsapp",
    source: srcNum,
    destination,
    "src.name": appName,
    message,
  });

  const { data } = await axios.post(`${baseUrl}/sm/api/v1/msg`, params.toString(), {
    headers: {
      apikey: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return data;
};
