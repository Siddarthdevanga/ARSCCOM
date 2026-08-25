import { db } from "../config/db.js";
import { sendCheckoutFeedbackWhatsApp } from "../utils/whatsapp.js";

/* ======================================================
   CHECKOUT + FEEDBACK CRON — runs every 5 minutes
   Sends one combined WhatsApp message 60 minutes after check-in,
   asking for feedback — tapping any of the 3 reply buttons both
   records that as feedback and checks the visitor out (handled in
   whatsapp.routes.js's inbound webhook, not here).

   Fires regardless of current status (even if already manually
   checked out) so the visitor still gets a chance to leave feedback —
   the reply handler just skips re-checking-out someone already OUT.

   No follow-up/reminder if they never reply — the existing end-of-day
   auto-checkout cron remains the fallback for anyone who doesn't
   respond.

   Window is 60 min–3 hr after check-in. The upper bound matters: without
   it, any downtime (a deploy, a cron outage, or just this feature going
   live for the first time) causes every already-old, never-flagged
   check-in to fire all at once on the next run — a confusing "why am I
   getting feedback requests for a visit from days ago" burst. Anything
   past 3 hours is marked handled without sending — a feedback request for
   a visit that old isn't useful anymore.
====================================================== */

const MAX_AGE_HOURS = 3;

export const sendCheckoutFeedbackMessages = async () => {
  try {
    const [visitors] = await db.query(
      `SELECT id, name, phone, company_id,
              check_in <= DATE_SUB(NOW(), INTERVAL ${MAX_AGE_HOURS} HOUR) AS tooOld
       FROM visitors
       WHERE checkout_feedback_sent = 0
         AND check_in <= DATE_SUB(NOW(), INTERVAL 60 MINUTE)`
    );

    for (const visitor of visitors) {
      if (!visitor.phone || visitor.tooOld) {
        // No phone on file, or past the useful window — mark handled
        // without sending so it's never retried or blasted as a backlog.
        await db.query(`UPDATE visitors SET checkout_feedback_sent = 1 WHERE id = ?`, [visitor.id]);
        if (visitor.tooOld) {
          console.warn(`[CHECKOUT-FEEDBACK] Visitor id ${visitor.id} check-in too old, skipping send`);
        }
        continue;
      }

      try {
        await sendCheckoutFeedbackWhatsApp({ phone: visitor.phone, visitorName: visitor.name });
        await db.query(`UPDATE visitors SET checkout_feedback_sent = 1 WHERE id = ?`, [visitor.id]);
        console.log(`[CHECKOUT-FEEDBACK] Sent to ${visitor.phone} (visitor id ${visitor.id})`);
      } catch (e) {
        console.error(`[CHECKOUT-FEEDBACK] Failed for visitor id ${visitor.id}:`, e.message);
        // leave unmarked — retried next run
      }
    }
  } catch (err) {
    console.error("[CHECKOUT-FEEDBACK CRON ERROR]", err.message);
  }
};
