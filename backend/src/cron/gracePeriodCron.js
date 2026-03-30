import { db } from "../config/db.js";
import { sendGracePeriodEmail } from "../utils/gracePeriodMail.service.js";

/* ======================================================
   GRACE PERIOD DAILY CHECKER
   Runs daily at 12:25 PM IST
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

      const [expiredCompanies] = await conn.execute(`
        SELECT
          c.id,
          c.name,
          u.email,
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
        } catch (err) {
          await conn.rollback();
          console.error(`   ❌ Error processing ${company.name}:`, err.message);
          stats.errors++;
        }
      }

      // ============================================================
      // STEP 2: PROCESS EXISTING GRACE PERIODS (Days 2-10)
      // ============================================================
      console.log("\n📋 STEP 2: Processing active grace periods...");

      const [activeGracePeriods] = await conn.execute(`
        SELECT
          c.id,
          c.name,
          u.email,
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

          // Only send email if we're on a new day
          if (currentDay > company.grace_period_day && currentDay <= 10) {
            // Update grace period day
            await conn.execute(
              `UPDATE companies
               SET grace_period_day = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [currentDay, company.id]
            );

            // Send daily reminder email
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

          // Update to expired status
          await conn.execute(
            `UPDATE companies
             SET subscription_status = 'expired',
                 grace_period_ends_at = NULL,
                 grace_period_day = 0,
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
export const triggerGracePeriodCheck = async (req, res) => {
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
