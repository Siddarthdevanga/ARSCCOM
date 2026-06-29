import { db } from "../config/db.js";
import { sendPaymentNurtureMessage } from "../services/gupshup.service.js";

/* ======================================================
   PAYMENT NURTURE CRON
   Re-engagement for companies with subscription_status='pending'
   who clicked "Proceed to Payment" but never completed it.

   Timing:
   - Msg 1 : 5 hours after last_payment_created_at
   - Msg 2 : 24 hours after Msg 1
   - Msg 3 : 3 days after Msg 2

   Stop condition: subscription_status changes from 'pending'
   (payment completed → trial/active/business)

   Messages sent as WhatsApp quick_reply (session messages).
   Requires phone in users table for the company admin.
====================================================== */

const normalizePhone = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  return d;
};

export const sendPaymentNurtureMessages = async () => {
  const send = async (company, msgNum) => {
    try {
      await sendPaymentNurtureMessage(normalizePhone(company.phone), company.name, msgNum);
      console.log(`[PAY-NURTURE] Msg ${msgNum} sent to ${company.phone} (${company.name})`);
    } catch (e) {
      console.error(`[PAY-NURTURE] Msg ${msgNum} failed for ${company.phone}:`, e.message);
    }
    await db.query(
      `UPDATE companies SET payment_nurture_step = ?, last_payment_nurture_sent_at = NOW() WHERE id = ?`,
      [msgNum, company.id]
    );
  };

  try {
    // Msg 1 — 5 hours after payment attempt, still pending
    const [msg1] = await db.query(
      `SELECT c.id, c.name, u.phone
       FROM companies c
       JOIN users u ON u.company_id = c.id AND u.role = 'user'
       WHERE c.subscription_status = 'pending'
         AND c.payment_nurture_step = 0
         AND c.last_payment_created_at <= DATE_SUB(NOW(), INTERVAL 5 HOUR)
         AND u.phone IS NOT NULL AND u.phone != ''
       GROUP BY c.id, u.phone`
    );
    for (const co of msg1) await send(co, 1);

    // Msg 2 — 24 hours after Msg 1, still pending
    const [msg2] = await db.query(
      `SELECT c.id, c.name, u.phone
       FROM companies c
       JOIN users u ON u.company_id = c.id AND u.role = 'user'
       WHERE c.subscription_status = 'pending'
         AND c.payment_nurture_step = 1
         AND c.last_payment_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND u.phone IS NOT NULL AND u.phone != ''
       GROUP BY c.id, u.phone`
    );
    for (const co of msg2) await send(co, 2);

    // Msg 3 — 3 days after Msg 2, still pending
    const [msg3] = await db.query(
      `SELECT c.id, c.name, u.phone
       FROM companies c
       JOIN users u ON u.company_id = c.id AND u.role = 'user'
       WHERE c.subscription_status = 'pending'
         AND c.payment_nurture_step = 2
         AND c.last_payment_nurture_sent_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
         AND u.phone IS NOT NULL AND u.phone != ''
       GROUP BY c.id, u.phone`
    );
    for (const co of msg3) await send(co, 3);

  } catch (err) {
    console.error("[PAY-NURTURE CRON ERROR]", err.message);
  }
};
