import { db } from "../config/db.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

/* ======================================================
   PRE-NURTURE CRON
   Re-engagement sequence for leads who messaged the bot
   but NEVER booked a demo and took no meaningful action.

   Stop condition: auto-stops if lead books a demo
   (NOT EXISTS on demo_appointments is checked each run)

   Timing:
   - Msg 1 : 1 day  after bot interaction
   - Msg 2 : 3 days after Msg 1
   - Msg 3 : 4 days after Msg 2

   Templates (create in Gupshup console, then set ENV vars):
     GUPSHUP_PRE_NURTURE_1  — re-engagement Day 1
     GUPSHUP_PRE_NURTURE_2  — follow-up Day 4
     GUPSHUP_PRE_NURTURE_3  — final nudge Day 8

   Suggested template body texts ({{1}} = lead name):
   Msg 1: "Hi {{1}}! 👋 You recently explored Promeet — the smart visitor
           management platform. Ready to see it in action? Book a free
           15-minute demo today and discover how Promeet can transform
           your business. Tap below to schedule!"
   Msg 2: "Hi {{1}}, just following up! 😊 Promeet makes visitor management
           effortless — digital check-ins, photo capture, real-time tracking,
           and detailed reports. Book your demo now and see it live!"
   Msg 3: "Hi {{1}}, one last note from us 🙏 Hundreds of businesses trust
           Promeet for smart visitor management. Book your demo this week —
           we'd love to show you what we can do. After this we'll stop
           sending reminders."
====================================================== */

const NO_DEMO = `
  NOT EXISTS (
    SELECT 1 FROM demo_appointments da
    WHERE da.phone = wl.phone
  )
`;

export const sendPreNurtureMessages = async () => {
  const t1 = process.env.GUPSHUP_PRE_NURTURE_1 || "";
  const t2 = process.env.GUPSHUP_PRE_NURTURE_2 || "";
  const t3 = process.env.GUPSHUP_PRE_NURTURE_3 || "";

  if (!t1 && !t2 && !t3) return;

  const send = async (lead, template, step) => {
    try {
      await sendWhatsAppTemplate(lead.phone, template, [lead.name || "there"]);
      console.log(`[PRE-NURTURE] Msg ${step} sent to ${lead.phone}`);
    } catch (e) {
      console.error(`[PRE-NURTURE] Msg ${step} failed for ${lead.phone}:`, e.message);
    }
    await db.query(
      `UPDATE whatsapp_leads
         SET pre_nurture_step = ?, last_pre_nurture_sent_at = NOW()
       WHERE id = ?`,
      [step, lead.id]
    );
  };

  try {
    // Msg 1 — 1 day after joining, no demo ever booked
    if (t1) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.pre_nurture_step = 0
           AND wl.unsubscribed = 0
           AND wl.created_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)
           AND ${NO_DEMO}`
      );
      for (const l of leads) await send(l, t1, 1);
    }

    // Msg 2 — 3 days after Msg 1, still no demo
    if (t2) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.pre_nurture_step = 1
           AND wl.unsubscribed = 0
           AND wl.last_pre_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
           AND ${NO_DEMO}`
      );
      for (const l of leads) await send(l, t2, 2);
    }

    // Msg 3 — 4 days after Msg 2, still no demo
    if (t3) {
      const [leads] = await db.query(
        `SELECT wl.id, wl.phone, wl.name FROM whatsapp_leads wl
         WHERE wl.pre_nurture_step = 2
           AND wl.unsubscribed = 0
           AND wl.last_pre_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 4 DAY)
           AND ${NO_DEMO}`
      );
      for (const l of leads) await send(l, t3, 3);
    }
  } catch (err) {
    console.error("[PRE-NURTURE CRON ERROR]", err.message);
  }
};
