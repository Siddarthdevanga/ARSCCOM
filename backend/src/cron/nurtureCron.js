import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   NURTURE CRON
   Runs every minute.
   - No demo booked: starts 2 days after created_at
   - Demo missed: restarts 2 days after missed WhatsApp sent
   - Demo upcoming / attended: paused
   Timing: Step1 day2, Step2 +2d, Final +3d, Closure +3d
====================================================== */

// Exclude only leads with an upcoming or attended demo
const NO_ACTIVE_DEMO = `
  NOT EXISTS (
    SELECT 1 FROM demo_appointments da
    WHERE da.phone = wl.phone
      AND (da.attended IS NULL OR da.attended = 1)
  )
`;

export const sendNurtureMessages = async () => {
  const t1 = process.env.GUPSHUP_NURTURE_1_TEMPLATE      || "";
  const t2 = process.env.GUPSHUP_NURTURE_2_TEMPLATE      || "";
  const tf = process.env.GUPSHUP_NURTURE_FINAL_TEMPLATE   || "";
  const tc = process.env.GUPSHUP_NURTURE_CLOSURE_TEMPLATE || "";

  if (!t1 && !t2 && !tf && !tc) return;

  const send = async (lead, template, step) => {
    try {
      await sendWhatsAppTemplate(lead.phone, template, [lead.name || "there"]);
      console.log(`[NURTURE] Step ${step} sent to ${lead.phone}`);
    } catch (e) {
      console.error(`[NURTURE] Step ${step} failed for ${lead.phone}:`, e.message);
    }
    await db.query(
      `UPDATE whatsapp_leads SET nurture_step = ?, last_nurture_sent_at = NOW() WHERE id = ?`,
      [step, lead.id]
    );
  };

  try {
    // Step 1 — 2 days after missed demo reset
    // Only for leads with demo history (no-demo leads handled by preNurtureCron)
    if (t1) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.nurture_step = 0 AND wl.unsubscribed = 0
           AND COALESCE(wl.last_nurture_sent_at, wl.created_at) <= DATE_SUB(NOW(), INTERVAL 2 DAY)
           AND ${NO_ACTIVE_DEMO}
           AND EXISTS (SELECT 1 FROM demo_appointments WHERE phone = wl.phone)`
      );
      for (const l of leads) await send(l, t1, 1);
    }

    // Step 2 — 2 days after step 1
    if (t2) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.nurture_step = 1 AND wl.unsubscribed = 0
           AND wl.last_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 2 DAY)
           AND ${NO_ACTIVE_DEMO}`
      );
      for (const l of leads) await send(l, t2, 2);
    }

    // Final — 3 days after step 2
    if (tf) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.nurture_step = 2 AND wl.unsubscribed = 0
           AND wl.last_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
           AND ${NO_ACTIVE_DEMO}`
      );
      for (const l of leads) await send(l, tf, 3);
    }

    // Closure — 3 days after final
    if (tc) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.nurture_step = 3 AND wl.unsubscribed = 0
           AND wl.last_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
           AND ${NO_ACTIVE_DEMO}`
      );
      for (const l of leads) await send(l, tc, 4);
    }
  } catch (err) {
    console.error("[NURTURE CRON ERROR]", err.message);
  }
};
