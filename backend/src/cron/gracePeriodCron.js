import { db } from "../config/db.js";
import { sendGracePeriodEmail } from "../utils/gracePeriodMail.service.js";
import { sendWhatsAppTemplate } from "../services/gupshup.service.js";

const normalizePhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

/* ======================================================
   GRACE PERIOD DAILY CHECKER
   Runs daily at 12:00 AM IST (midnight)
   - Checks expired subscriptions
   - Initiates grace period
   - Sends daily reminder emails
   - Suspends accounts after 10 days
====================================================== */

export const checkAndSendGracePeriodEmails = async () => {
  const startTime = Date.now();
  console.log("\n" + "=".repeat(60));
  console.log("🔄 GRACE PERIOD CRON JOB STARTED");
  console.log("=".repeat(60));
  console.log(`⏰ Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);

  let stats = {
    newGracePeriods: 0,
    emailsSent: 0,
    suspended: 0,
    errors: 0,
  };

  try {
    const conn = await db.getConnection();

    try {
      // ============================================================
      // STEP 1: FIND EXPIRED SUBSCRIPTIONS NOT YET IN GRACE PERIOD
      // ============================================================
      console.log("\n📋 STEP 1: Checking for newly expired subscriptions...");

      // NOTE: only 'active'/'trial' here — NOT 'expired'. A company already
      // fully suspended (status = 'expired') has a permanently past-dated
      // trial_ends_at/subscription_ends_at that it never grows out of, so
      // including 'expired' here used to re-match it every single day,
      // restarting the whole 10-day grace-period email cycle forever. Once
      // a company is 'expired' it belongs to STEP 4's monthly reminder, not
      // a fresh grace period.
      const [expiredCompanies] = await conn.execute(`
        SELECT
          c.id,
          c.name,
          u.email,
          u.phone,
          c.plan,
          c.subscription_status,
          c.trial_ends_at,
          c.subscription_ends_at
        FROM companies c
        INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
        WHERE c.subscription_status IN ('active', 'trial')
          AND c.grace_period_ends_at IS NULL
          AND (
            (c.plan = 'trial' AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at < NOW())
            OR
            (c.plan != 'trial' AND c.subscription_ends_at IS NOT NULL AND c.subscription_ends_at < NOW())
          )
        GROUP BY c.id, u.email
      `);

      console.log(`   Found ${expiredCompanies.length} newly expired subscription(s)`);

      for (const company of expiredCompanies) {
        try {
          await conn.beginTransaction();

          const expiryDate = company.plan === "trial"
            ? company.trial_ends_at
            : company.subscription_ends_at;

          // Calculate grace period end (10 days from expiry)
          const gracePeriodEnds = new Date(expiryDate);
          gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 10);

          // Update company to grace period status
          await conn.execute(
            `UPDATE companies
             SET subscription_status = 'grace_period',
                 grace_period_ends_at = ?,
                 grace_period_day = 1,
                 updated_at = NOW()
             WHERE id = ?`,
            [gracePeriodEnds, company.id]
          );

          await conn.commit();

          // Send Day 1 email
          const emailSent = await sendGracePeriodEmail({
            companyName: company.name,
            adminEmail:  company.email,
            day: 1,
            gracePeriodEndsAt: gracePeriodEnds,
            planType: company.plan,
          });

          if (emailSent) {
            stats.newGracePeriods++;
            stats.emailsSent++;
            console.log(`   ✅ ${company.name} (ID: ${company.id}) - Grace period started → ${company.email}`);
          } else {
            console.log(`   ⚠️  ${company.name} (ID: ${company.id}) - Grace period started but email failed`);
            stats.newGracePeriods++;
          }

          // WhatsApp — plan expired notice (plan-specific template)
          const expiredTemplate = company.plan === "business"
            ? (process.env.GUPSHUP_BUSINESS_EXPIRED_TEMPLATE || "")
            : (process.env.GUPSHUP_TRIAL_EXPIRED_TEMPLATE    || "");
          if (expiredTemplate && company.phone) {
            try {
              await sendWhatsAppTemplate(normalizePhone(company.phone), expiredTemplate, [company.name]);
              console.log(`   📱 ${company.plan} expired WhatsApp sent to ${company.phone}`);
            } catch (e) {
              console.error(`   ❌ Expired WhatsApp failed:`, e.message);
            }
          }
        } catch (err) {
          await conn.rollback();
          console.error(`   ❌ Error processing ${company.name}:`, err.message);
          stats.errors++;
        }
      }

      // ============================================================
      // STEP 2: PROCESS EXISTING GRACE PERIODS
      // Reminder cadence is intentionally sparse — Day 1 (STEP 1, start of
      // grace period) → Day 5 (this step, halfway point) → Day 11 (STEP 3,
      // suspension). No daily emails in between.
      // ============================================================
      console.log("\n📋 STEP 2: Processing active grace periods...");

      const [activeGracePeriods] = await conn.execute(`
        SELECT
          c.id,
          c.name,
          u.email,
          u.phone,
          c.plan,
          c.grace_period_ends_at,
          c.grace_period_day,
          c.subscription_ends_at,
          c.trial_ends_at
        FROM companies c
        INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
        WHERE c.subscription_status = 'grace_period'
          AND c.grace_period_ends_at IS NOT NULL
          AND c.grace_period_ends_at >= NOW()
        GROUP BY c.id, u.email
      `);

      console.log(`   Found ${activeGracePeriods.length} active grace period(s)`);

      for (const company of activeGracePeriods) {
        try {
          const expiryDate = company.plan === "trial"
            ? new Date(company.trial_ends_at)
            : new Date(company.subscription_ends_at);

          const today = new Date();
          const daysSinceExpiry = Math.floor((today - expiryDate) / (1000 * 60 * 60 * 24));
          const currentDay = daysSinceExpiry + 1; // Day 1 = first day after expiry

          // Day 5 halfway-point reminder — the only email in this step.
          // (Day 1 was sent by STEP 1 when grace period started; the final
          // suspension email is sent by STEP 3.) Guarded by grace_period_day
          // so a re-run on the same day never double-sends.
          if (currentDay === 5 && company.grace_period_day < 5) {
            await conn.execute(
              `UPDATE companies
               SET grace_period_day = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [currentDay, company.id]
            );

            const emailSent = await sendGracePeriodEmail({
              companyName: company.name,
              adminEmail:  company.email,
              day: currentDay,
              gracePeriodEndsAt: company.grace_period_ends_at,
              planType: company.plan,
            });

            if (emailSent) {
              stats.emailsSent++;
              console.log(`   ✅ ${company.name} (ID: ${company.id}) - Day ${currentDay} email sent → ${company.email}`);
            } else {
              console.log(`   ⚠️  ${company.name} (ID: ${company.id}) - Day ${currentDay} email failed`);
            }
          }

          // Day 9 = 1 day before 10-day grace ends → send WhatsApp final warning.
          // Kept on its own schedule, independent of the email cadence above.
          if (currentDay === 9 && company.grace_period_day < 9) {
            await conn.execute(
              `UPDATE companies SET grace_period_day = ?, updated_at = NOW() WHERE id = ?`,
              [currentDay, company.id]
            );

            const graceEndTemplate = company.plan === "business"
              ? (process.env.GUPSHUP_BUSINESS_GRACE_ENDING_TEMPLATE || "")
              : (process.env.GUPSHUP_GRACE_ENDING_TEMPLATE          || "");
            if (graceEndTemplate && company.phone) {
              try {
                await sendWhatsAppTemplate(normalizePhone(company.phone), graceEndTemplate, [company.name]);
                console.log(`   📱 ${company.plan} grace ending WhatsApp sent to ${company.phone}`);
              } catch (e) {
                console.error(`   ❌ Grace ending WhatsApp failed:`, e.message);
              }
            }
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${company.name}:`, err.message);
          stats.errors++;
        }
      }

      // ============================================================
      // STEP 3: SUSPEND COMPANIES PAST GRACE PERIOD
      // ============================================================
      console.log("\n📋 STEP 3: Suspending expired grace periods...");

      const [expiredGracePeriods] = await conn.execute(`
        SELECT
          c.id,
          c.name,
          u.email,
          c.plan,
          c.grace_period_ends_at
        FROM companies c
        INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
        WHERE c.subscription_status = 'grace_period'
          AND c.grace_period_ends_at IS NOT NULL
          AND c.grace_period_ends_at < NOW()
        GROUP BY c.id, u.email
      `);

      console.log(`   Found ${expiredGracePeriods.length} expired grace period(s)`);

      for (const company of expiredGracePeriods) {
        try {
          await conn.beginTransaction();

          // Update to expired status. expired_reminder_last_sent_at is set
          // here too — the suspension email below counts as the first
          // "expired" notice, so STEP 4's monthly reminder starts counting
          // from today rather than firing again immediately.
          await conn.execute(
            `UPDATE companies
             SET subscription_status = 'expired',
                 grace_period_ends_at = NULL,
                 grace_period_day = 0,
                 expired_reminder_last_sent_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [company.id]
          );

          await conn.commit();

          // Send suspension email
          const emailSent = await sendGracePeriodEmail({
            companyName: company.name,
            adminEmail:  company.email,
            day: 11, // Suspension email
            gracePeriodEndsAt: company.grace_period_ends_at,
            planType: company.plan,
          });

          if (emailSent) {
            stats.suspended++;
            stats.emailsSent++;
            console.log(`   ✅ ${company.name} (ID: ${company.id}) - Account suspended → ${company.email}`);
          } else {
            console.log(`   ⚠️  ${company.name} (ID: ${company.id}) - Suspended but email failed`);
            stats.suspended++;
          }
        } catch (err) {
          await conn.rollback();
          console.error(`   ❌ Error suspending ${company.name}:`, err.message);
          stats.errors++;
        }
      }

      // ============================================================
      // STEP 4: MONTHLY REMINDER FOR ALREADY-SUSPENDED COMPANIES
      // Once a company is fully 'expired' (past grace period), it no
      // longer gets daily/weekly emails — just one reminder every 30 days
      // until it renews, tracked via expired_reminder_last_sent_at.
      // ============================================================
      console.log("\n📋 STEP 4: Monthly reminders for suspended accounts...");

      const [dueForMonthlyReminder] = await conn.execute(`
        SELECT c.id, c.name, u.email, c.plan
        FROM companies c
        INNER JOIN users u ON u.company_id = c.id AND u.role = 'user' AND u.is_active = 1
        WHERE c.subscription_status = 'expired'
          AND (
            c.expired_reminder_last_sent_at IS NULL
            OR c.expired_reminder_last_sent_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
          )
        GROUP BY c.id, u.email
      `);

      console.log(`   Found ${dueForMonthlyReminder.length} suspended account(s) due for a monthly reminder`);

      for (const company of dueForMonthlyReminder) {
        try {
          const emailSent = await sendGracePeriodEmail({
            companyName: company.name,
            adminEmail:  company.email,
            day: 12, // Monthly "still suspended" reminder
            gracePeriodEndsAt: null,
            planType: company.plan,
          });

          await conn.execute(
            `UPDATE companies SET expired_reminder_last_sent_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [company.id]
          );

          if (emailSent) {
            stats.emailsSent++;
            console.log(`   ✅ ${company.name} (ID: ${company.id}) - Monthly reminder sent → ${company.email}`);
          } else {
            console.log(`   ⚠️  ${company.name} (ID: ${company.id}) - Monthly reminder failed`);
          }
        } catch (err) {
          console.error(`   ❌ Error sending monthly reminder to ${company.name}:`, err.message);
          stats.errors++;
        }
      }
    } finally {
      conn.release();
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(60));
    console.log("✅ GRACE PERIOD CRON JOB COMPLETED");
    console.log("=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - New grace periods started: ${stats.newGracePeriods}`);
    console.log(`   - Emails sent: ${stats.emailsSent}`);
    console.log(`   - Accounts suspended: ${stats.suspended}`);
    console.log(`   - Errors: ${stats.errors}`);
    console.log(`   - Duration: ${duration}s`);
    console.log("=".repeat(60) + "\n");

    return stats;
  } catch (error) {
    console.error("\n❌ GRACE PERIOD CRON JOB FAILED:", error);
    console.error(error.stack);
    throw error;
  }
};

/* ======================================================
   MANUAL TRIGGER (for testing)
====================================================== */
export const triggerGracePeriodCheck = async (_req, res) => {
  try {
    console.log("🔧 Manual grace period check triggered");
    const stats = await checkAndSendGracePeriodEmails();

    return res.json({
      success: true,
      message: "Grace period check completed",
      stats,
    });
  } catch (error) {
    console.error("Manual trigger error:", error);
    return res.status(500).json({
      success: false,
      message: "Grace period check failed",
      error: error.message,
    });
  }
};