/**
 * constants/promoCodes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hardcoded for now — a single live promo. Worth promoting to a small
 * DB-backed table (code -> {plan, interval, offerId}) once there's a second
 * one to manage; not worth that scope while there's only one. Shared between
 * upgrade.route.js (existing customers upgrading from /home/plans) and
 * payment.routes.js (first-time plan selection from /subscription) so both
 * entry points recognize the same codes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PROMO_CODES = {
  WEB30: { plan: "business", interval: "annual", offerId: "offer_TXWDAIEBKUPewZ" },
};

/**
 * Validates a promo code against the plan/interval being purchased.
 * Returns { offerId } on success (offerId is undefined if no code was
 * given at all — not an error), or { error } with a user-facing message.
 */
export const resolvePromoOfferId = (promoCode, plan, interval) => {
  if (!promoCode) return { offerId: undefined };

  const promo = PROMO_CODES[String(promoCode).trim().toUpperCase()];
  if (!promo || promo.plan !== plan || promo.interval !== interval) {
    return { error: "This promo code isn't valid for the selected plan" };
  }
  return { offerId: promo.offerId };
};
