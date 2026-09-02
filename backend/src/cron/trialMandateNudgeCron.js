import { db } from "../config/db.js";
import { sendEmail } from "../utils/mailer.js";
import { emailFooter } from "../services/auth.service.js";

/* ======================================================
   TRIAL MANDATE NUDGE CRON — runs daily at 11 AM IST
   For trial-plan companies with NO Razorpay mandate on file at all
   (signed up under the old one-time-Order flow, before the
   auto-convert-to-Business subscription flow existed) and still
   eligible (subscription_status trial or grace_period), sends up to
   3 emails nudging them to add auto-pay via /home/plans:

     pre_expiry  — trial still active, <= 3 days left before trial_ends_at
     grace_start — the moment they drop into grace_period
     grace_final — grace_period active, <= 3 days left before
                   grace_period_ends_at (last chance before expiry)

   mandate_nudge_sent is a CSV of stage names already sent, so each
   stage fires at most once per company. A company that adds a mandate
   at any point drops out of the query entirely (razorpay_subscription_id
   becomes non-null), so no further nudges go out.
====================================================== */

const STAGES = ["pre_expiry", "grace_start", "grace_final"];

const alreadySent = (csv, stage) => (csv || "").split(",").filter(Boolean).includes(stage);

const markSent = async (companyId, csv, stage) => {
  const stages = (csv || "").split(",").filter(Boolean);
  if (!stages.includes(stage)) stages.push(stage);
  await db.query(`UPDATE companies SET mandate_nudge_sent = ? WHERE id = ?`, [stages.join(","), companyId]);
};

const sendNudgeEmail = async ({ email, companyName, subject, headline, body, ctaLabel }) => {
  await sendEmail({
    to: email,
    subject,
    html: `
      <div style="max-width:520px;margin:0 auto;border:1px solid #e0d9f0;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <div style="background:#221C53;background-image:linear-gradient(95deg,#221C53,#3d2a7a);padding:28px 28px 24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.02em;">H<span style="color:#FDBA74;">ai</span> Visitor</div>
        </div>
        <div style="padding:28px;">
          <p style="font-size:15px;color:#262046;">Hello <b>${companyName}</b>,</p>
          <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 18px;margin:20px 0;">
            <h3 style="color:#EA580C;margin:0 0 8px;font-size:15px;">${headline}</h3>
            <p style="font-size:13px;color:#6E6890;margin:0;">${body}</p>
          </div>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://www.haivisitor.zodopt.com/home/plans" style="display:inline-block;background:#F97316;background-image:linear-gradient(95deg,#F97316,#EF3E66);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
              ${ctaLabel}
            </a>
          </div>
          ${emailFooter()}
        </div>
      </div>
    `,
  });
};

export const sendMandateNudges = async () => {
  try {
    const [companies] = await db.query(
      `SELECT c.id, c.name, c.subscription_status, c.trial_ends_at, c.grace_period_ends_at,
              c.mandate_nudge_sent,
              (SELECT u.email FROM users u WHERE u.company_id = c.id AND u.role = 'user' AND u.is_active = 1 LIMIT 1) as email
       FROM companies c
       WHERE c.plan = 'trial'
         AND c.razorpay_subscription_id IS NULL
         AND c.subscription_status IN ('trial', 'grace_period')`
    );

    const now = Date.now();

    for (const company of companies) {
      if (!company.email) continue;
      const sent = company.mandate_nudge_sent || "";

      try {
        if (
          company.subscription_status === "trial" &&
          company.trial_ends_at &&
          !alreadySent(sent, "pre_expiry")
        ) {
          const daysLeft = Math.ceil((new Date(company.trial_ends_at).getTime() - now) / 86400000);
          if (daysLeft >= 0 && daysLeft <= 3) {
            await sendNudgeEmail({
              email: company.email,
              companyName: company.name,
              subject: "Your Hai Visitor trial ends soon — add auto-pay to keep going",
              headline: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
              body: "Add a payment method now so your Hai Visitor Business Plan (₹500/month + GST) continues automatically — no gap in access, no re-registering.",
              ctaLabel: "Add Auto-Pay",
            });
            await markSent(company.id, sent, "pre_expiry");
            console.log(`[MANDATE-NUDGE] pre_expiry sent to ${company.email} (${company.name})`);
          }
          continue;
        }

        if (company.subscription_status === "grace_period" && !alreadySent(sent, "grace_start")) {
          await sendNudgeEmail({
            email: company.email,
            companyName: company.name,
            subject: "Your Hai Visitor trial has ended — reactivate now",
            headline: "Add auto-pay to reactivate instantly",
            body: "Your 15-day trial has ended. Add a payment method now and your Hai Visitor Business Plan (₹500/month + GST) starts right away — pick up exactly where you left off.",
            ctaLabel: "Reactivate My Account",
          });
          await markSent(company.id, sent, "grace_start");
          console.log(`[MANDATE-NUDGE] grace_start sent to ${company.email} (${company.name})`);
          continue;
        }

        if (
          company.subscription_status === "grace_period" &&
          company.grace_period_ends_at &&
          !alreadySent(sent, "grace_final")
        ) {
          const daysLeft = Math.ceil((new Date(company.grace_period_ends_at).getTime() - now) / 86400000);
          if (daysLeft >= 0 && daysLeft <= 3) {
            await sendNudgeEmail({
              email: company.email,
              companyName: company.name,
              subject: "Last chance — your Hai Visitor account will be deactivated soon",
              headline: `Your account will be deactivated in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
              body: "This is your final reminder — add a payment method now to keep your Hai Visitor account and all its data. After this, your account will be marked expired.",
              ctaLabel: "Add Auto-Pay Now",
            });
            await markSent(company.id, sent, "grace_final");
            console.log(`[MANDATE-NUDGE] grace_final sent to ${company.email} (${company.name})`);
          }
        }
      } catch (e) {
        console.error(`[MANDATE-NUDGE] failed for company ${company.id} (${company.name}):`, e.message);
      }
    }
  } catch (err) {
    console.error("[MANDATE-NUDGE CRON ERROR]", err.message);
  }
};

export { STAGES };
