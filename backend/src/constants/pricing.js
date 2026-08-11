/**
 * constants/pricing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for plan pricing (base amount + 18% GST) and plan
 * feature limits (conference rooms/bookings), shared across payment.routes.js,
 * upgrade.route.js, conference.routes.js, and superadmin.service.js. Previously
 * each of those kept its own copy of these numbers — this file replaces all of
 * them so plan changes only ever need to happen in one place.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const GST_RATE = 0.18;

export const PLAN_PRICING = {
  trial:      { monthly: 49 },
  business:   { monthly: 500, annual: 6000 },
  enterprise: { monthly: 700, annual: 7000 },
};

// Business is visitor-management only — no conference booking at all. Trial
// previews the Business tier, so it gets the same restriction. Enterprise is
// the only plan that bundles conference room booking.
export const PLAN_FEATURES = {
  trial:      { rooms: 0,        bookings: 0,        conference: false },
  business:   { rooms: 0,        bookings: 0,        conference: false },
  enterprise: { rooms: Infinity, bookings: Infinity,  conference: true },
};

/**
 * Returns { base, gst, total, totalStr } for a plan + interval, or null if
 * that plan/interval combination has no defined price.
 */
export const calcPrice = (plan, interval = "monthly") => {
  const base = PLAN_PRICING[plan]?.[interval];
  if (base == null) return null;

  const gst   = +(base * GST_RATE).toFixed(2);
  const total = +(base + gst).toFixed(2);

  return { base, gst, total, totalStr: total.toFixed(2) };
};
