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
  business:   { monthly: 500,  annual: 5500 },
  enterprise: { monthly: 1000, annual: 10000 },
};

// Business is visitor-management only — no conference booking at all.
// Trial gets a capped taste of conference booking (2 rooms / 100 bookings,
// lifetime total for the 15-day trial window — see getBookingUsage() in
// conference.routes.js) as an incentive to upgrade to Enterprise for
// unlimited access. Enterprise is the only plan with unlimited booking.
export const PLAN_FEATURES = {
  trial:      { rooms: 2,        bookings: 100,       conference: true  },
  business:   { rooms: 0,        bookings: 0,         conference: false },
  enterprise: { rooms: Infinity, bookings: Infinity,  conference: true  },
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

/**
 * Razorpay Plan IDs — created manually in the Razorpay dashboard (Business/
 * Enterprise × Monthly/Annual, GST-inclusive amounts baked into each Plan
 * directly, matching PLAN_PRICING above with GST applied). Trial has no
 * Razorpay Plan — it stays a one-time Orders-API charge, never a recurring
 * subscription.
 */
export const getRazorpayPlanId = (plan, interval) => {
  const key = `RAZORPAY_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[key] || null;
};

/**
 * Reverse lookup — given a Razorpay Plan ID (from a webhook payload), returns
 * { plan, interval } or null if it doesn't match any configured plan.
 */
export const razorpayPlanIdToPlan = (planId) => {
  for (const plan of ["business", "enterprise"]) {
    for (const interval of ["monthly", "annual"]) {
      if (getRazorpayPlanId(plan, interval) === planId) return { plan, interval };
    }
  }
  return null;
};
