import crypto from "crypto";

// Ambiguous characters (0/O, 1/l/I) excluded — this password gets read off a
// WhatsApp message or email and typed back in by hand.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Generates a random temp password (12 chars) for accounts created via the
 * Razorpay payment-link flow, where the person never chose their own
 * password. Forced to be changed on first login via users.must_change_password.
 */
export const generateTempPassword = (length = 12) => {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += CHARSET[bytes[i] % CHARSET.length];
  }
  return password;
};
