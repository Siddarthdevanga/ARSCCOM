import crypto from "crypto";

/* ======================================================
   RAZORPAY SIGNATURE VERIFICATION
   --------------------------------------------------------
   Shared by every Razorpay webhook (subscriptions and, historically,
   the one-time trial Order). Trial itself is no longer Orders-API
   based — see razorpayTrialSubscription.service.js — but this stays
   here as the one signature-verification helper used across the board.
====================================================== */
export const verifyRazorpaySignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};

// Superadmin's "Razorpay Payment Source" tab still calls
// razorpayService.resendTrialPassword(companyId) — the real
// implementation now lives with the rest of the trial-subscription
// flow it belongs to; re-exported here so that call site needs no change.
export { resendTrialPassword } from "./razorpayTrialSubscription.service.js";
