/**
 * constants/pricing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for plan pricing (base amount + 18% GST), shared by
 * payment.routes.js and upgrade.route.js. Previously each of those files kept
 * its own copy of these numbers — this file replaces both so the base prices
 * only ever need changing in one place.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const GST_RATE = 0.18;

export const PLAN_PRICING = {
  trial:    { monthly: 49 },
  business: { monthly: 500, annual: 6000 },
};

/**
 * Returns { base, gst, total, totalStr } for a plan + interval, or null if
 * that plan/interval combination has no defined price (e.g. enterprise,
 * which is custom/contact-only, or business/annual before this existed).
 */
export const calcPrice = (plan, interval = "monthly") => {
  const base = PLAN_PRICING[plan]?.[interval];
  if (base == null) return null;

  const gst   = +(base * GST_RATE).toFixed(2);
  const total = +(base + gst).toFixed(2);

  return { base, gst, total, totalStr: total.toFixed(2) };
};
