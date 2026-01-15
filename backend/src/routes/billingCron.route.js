import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";
import { sendEmail } from "../services/email.service.js";

const router = express.Router();

/* ================= STATUS NORMALIZER ================= */
function normalizeStatus(status) {
  if (!status) return null;
  status = status.toLowerCase();

  const map = {
    generated: "pending",
    created: "pending",
    initiated: "pending",
    success: "paid",
    paid: "paid",
    failure: "failed",
    failed: "failed",
    expired: "expired",
    cancelled: "expired",
    canceled: "expired"
  };

  return map[status] || status;
}

/* ================= EMAIL TEMPLATES ================= */
const emailTemplates = {
  subscriptionActivated: (companyName, plan, expiresAt) => {
    const planDetails = {
      trial: {
        price: '₹49 / 15 Days',
        features: ['Valid for 15 Days', '100 Visitor Bookings', '100 Conference Bookings', '2 Conference Rooms']
      },
      business: {
        price: '₹500 / Month',
        features: ['Unlimited Visitors', '1000 Conference bookings', '6 Conference Rooms', 'Dedicated Support']
      },
      enterprise: {
        price: 'Custom Pricing',
        features: ['Unlimited Visitors', 'Unlimited Conference Bookings', 'Unlimited Conference Rooms', 'Dedicated Support']
      }
    };

    const currentPlan = planDetails[plan.toLowerCase()] || planDetails.trial;

    return {
      subject: `🎉 Your PROMEET Subscription is Now Active!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; }
            .success-icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
            .info-box { background: #f7f4ff; padding: 25px; margin: 25px 0; border-left: 4px solid #6a00ff; border-radius: 8px; }
            .info-row { display: flex; justify-content: space-between; margin: 12px 0; }
            .label { font-weight: 600; color: #555; }
            .value { color: #333; font-weight: 700; }
            .plan-badge { background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 8px 20px; border-radius: 25px; display: inline-block; font-weight: bold; }
            .features { background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0; }
            .features h3 { margin-top: 0; color: #6a00ff; }
            .features ul { list-style: none; padding: 0; }
            .features li { padding: 10px 0; padding-left: 30px; position: relative; }
            .features li:before { content: "✓"; position: absolute; left: 0; color: #00c853; font-weight: bold; font-size: 18px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to PROMEET!</h1>
              <p>Your subscription is now active</p>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2 style="text-align: center;">Subscription Activated Successfully</h2>
              <p>Dear <strong>${companyName}</strong> Team,</p>
              <p>Your PROMEET subscription has been successfully activated.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Plan:</span>
                  <span class="plan-badge">${plan.toUpperCase()}</span>
                </div>
                <div class="info-row">
                  <span class="label">Price:</span>
                  <span class="value">${currentPlan.price}</span>
                </div>
                <div class="info-row">
                  <span class="label">Valid Until:</span>
                  <span class="value">${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              <div class="features">
                <h3>✨ Your ${plan.toUpperCase()} Plan Includes:</h3>
                <ul>
                  ${currentPlan.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="https://www.promeet.zodopt.com" class="cta-button">Access Dashboard</a>
              </div>
            </div>
            <div class="footer">
              <p><strong>PROMEET</strong> - Visitor & Conference Management</p>
              <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  upgradeCompleted: (companyName, fromPlan, toPlan, expiresAt) => ({
    subject: `🚀 Your Plan Has Been Upgraded Successfully!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #7a00ff, #9500ff); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .upgrade-icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
          .upgrade-flow { text-align: center; margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 10px; }
          .plan-badge { display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: bold; margin: 0 15px; }
          .old-plan { background: #e0e0e0; color: #666; }
          .new-plan { background: linear-gradient(135deg, #00c853, #00e676); color: white; }
          .arrow { color: #7a00ff; font-size: 28px; margin: 0 10px; }
          .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>Your plan has been upgraded</p>
          </div>
          <div class="content">
            <div class="upgrade-icon">🚀</div>
            <h2 style="text-align: center;">Plan Upgrade Successful</h2>
            <p>Dear <strong>${companyName}</strong> Team,</p>
            <p>Your account has been upgraded to <strong>${toPlan.toUpperCase()}</strong> plan.</p>
            
            <div class="upgrade-flow">
              <span class="plan-badge old-plan">${fromPlan.toUpperCase()}</span>
              <span class="arrow">→</span>
              <span class="plan-badge new-plan">${toPlan.toUpperCase()}</span>
            </div>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong></p>
            <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  subscriptionExpiring: (companyName, plan, expiresAt, daysLeft) => ({
    subject: `⚠️ Your PROMEET Subscription Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #ff9800, #ffa726); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .countdown { font-size: 48px; font-weight: bold; color: #ff9800; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Subscription Expiring Soon</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${companyName}</strong> Team,</p>
            <p>Your subscription expires in:</p>
            <div class="countdown">${daysLeft}</div>
            <p style="text-align: center; font-weight: bold;">${daysLeft === 1 ? 'Day' : 'Days'}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  subscriptionExpired: (companyName, plan, expiredAt) => ({
    subject: `🔴 Your PROMEET Subscription Has Expired`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #ff1744, #f50057); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Subscription Expired</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${companyName}</strong> Team,</p>
            <p>Your subscription expired on <strong>${new Date(expiredAt).toLocaleDateString()}</strong>.</p>
            <p>Please renew to regain access.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

/* ================= MAIN CRON ================= */
async function repairBilling() {
  console.log("⏳ CRON: Checking companies for billing repair...");

  const [companies] = await db.query(
    `
      SELECT 
        c.id,
        c.name,
        c.plan,
        c.zoho_customer_id,
        c.last_payment_link_id,
        c.pending_upgrade_plan,
        c.subscription_status,
        c.subscription_ends_at,
        c.trial_ends_at,
        (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) as company_email
      FROM companies c
      WHERE 
        c.zoho_customer_id IS NOT NULL
      AND c.last_payment_link_id IS NOT NULL
      AND (
          c.subscription_status IN ('pending','trial')
          OR c.pending_upgrade_plan IS NOT NULL
          OR (
            c.subscription_status='active'
            AND (
              (c.plan='trial' AND c.trial_ends_at IS NULL)
              OR
              (c.plan='business' AND c.subscription_ends_at IS NULL)
            )
          )
      )
    `
  );

  if (!companies.length) {
    console.log("✅ No companies need processing");
  }

  const token = await getZohoAccessToken();
  if (!token) {
    console.log("❌ Zoho Token Missing");
    return;
  }

  for (const company of companies) {
    const { id, name, plan, last_payment_link_id, pending_upgrade_plan, subscription_status, company_email } = company;

    console.log(`\n🏢 Checking Company → ${name} (${id})`);
    console.log(`   Current: plan=${plan}, status=${subscription_status}`);
    if (pending_upgrade_plan) {
      console.log(`   📋 Pending Upgrade: ${plan} → ${pending_upgrade_plan}`);
    }

    try {
      const payRes = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${last_payment_link_id}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );

      const payment = payRes?.data?.payment_link;
      if (!payment) {
        console.log("⚠ Payment link not found");
        continue;
      }

      const status = normalizeStatus(payment.status);
      console.log("🔍 Zoho Payment Status:", status);

      /* ================== PAYMENT SUCCESS ================== */
      if (status === "paid") {
        console.log("🎯 Payment Success — Activating");

        let paidAt = payment?.paid_at || payment?.updated_time || payment?.created_time || new Date().toISOString();
        let paidDate = new Date(paidAt);
        if (isNaN(paidDate.getTime())) paidDate = new Date();

        const mysqlPaid = paidDate.toISOString().slice(0, 19).replace("T", " ");
        const activePlan = pending_upgrade_plan || plan;
        const durationDays = activePlan === "business" ? 30 : 15;
        const endsAtDate = new Date(paidDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const mysqlEnds = endsAtDate.toISOString().slice(0, 19).replace("T", " ");

        console.log("💰 Paid At:", mysqlPaid);
        console.log("📅 Ends At:", mysqlEnds);
        console.log("📦 Activating Plan:", activePlan);

        if (activePlan === "business") {
          await db.query(
            `UPDATE companies SET subscription_status='active', plan='business', pending_upgrade_plan=NULL, last_payment_created_at=?, subscription_ends_at=?, updated_at=NOW() WHERE id=?`,
            [mysqlPaid, mysqlEnds, id]
          );
        } else {
          await db.query(
            `UPDATE companies SET subscription_status='active', plan='trial', pending_upgrade_plan=NULL, last_payment_created_at=?, trial_ends_at=?, updated_at=NOW() WHERE id=?`,
            [mysqlPaid, mysqlEnds, id]
          );
        }

        if (company_email) {
          try {
            const emailContent = pending_upgrade_plan
              ? emailTemplates.upgradeCompleted(name, plan, activePlan, mysqlEnds)
              : emailTemplates.subscriptionActivated(name, activePlan, mysqlEnds);
            await sendEmail(company_email, emailContent.subject, emailContent.html);
            console.log(`📧 Email sent to ${company_email}`);
          } catch (emailErr) {
            console.error("❌ Email failed:", emailErr.message);
          }
        }

        console.log(pending_upgrade_plan ? `✅ UPGRADE COMPLETED: ${plan} → ${activePlan}` : "✅ ACTIVATION SUCCESSFUL");
        continue;
      }

      /* ================= FAILED / EXPIRED - CRITICAL FIX ================= */
      if (status === "expired" || status === "failed") {
        console.log("❌ Payment expired/failed");

        if (pending_upgrade_plan) {
          // This was an UPGRADE attempt - just clear pending_upgrade_plan
          // CRITICAL: Keep subscription_status unchanged (user keeps current access)
          console.log(`🔄 Clearing pending upgrade for ${name}`);
          console.log(`   ✅ Current plan (${plan}) and status (${subscription_status}) remain unchanged`);
          
          await db.query(
            `UPDATE companies SET pending_upgrade_plan=NULL, updated_at=NOW() WHERE id=?`,
            [id]
          );
        } else {
          // This was INITIAL payment - only mark pending if not currently active
          if (subscription_status === 'active' || subscription_status === 'trial') {
            console.log(`✅ Keeping ${name} active despite failed payment link`);
            // Don't change status - user still has valid subscription
          } else {
            console.log(`⚠️ Marking subscription as pending for ${name}`);
            await db.query(
              `UPDATE companies SET subscription_status='pending', updated_at=NOW() WHERE id=?`,
              [id]
            );
          }
        }

        continue;
      }

      console.log("⏳ Payment still pending");
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  }

  await checkExpiringSubscriptions();
  console.log("\n✅ CRON Completed\n");
}

/* ================= CHECK EXPIRING SUBSCRIPTIONS ================= */
async function checkExpiringSubscriptions() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const mysqlThreeDays = threeDaysFromNow.toISOString().slice(0, 19).replace("T", " ");

  // Expiring soon
  const [expiring] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at, 
      (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) as company_email
      FROM companies c
      WHERE c.subscription_status = 'active'
      AND ((c.plan = 'business' AND c.subscription_ends_at BETWEEN NOW() AND ?) 
      OR (c.plan = 'trial' AND c.trial_ends_at BETWEEN NOW() AND ?))
    `,
    [mysqlThreeDays, mysqlThreeDays]
  );

  for (const company of expiring) {
    if (!company.company_email) continue;
    const expiresAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;
    const daysLeft = Math.ceil((new Date(expiresAt) - now) / (1000 * 60 * 60 * 24));
    const emailContent = emailTemplates.subscriptionExpiring(company.name, company.plan, expiresAt, daysLeft);
    await sendEmail(company.company_email, emailContent.subject, emailContent.html);
  }

  // Expired
  const [expired] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at, 
      (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) as company_email
      FROM companies c
      WHERE c.subscription_status = 'active'
      AND ((c.plan = 'business' AND c.subscription_ends_at < NOW()) 
      OR (c.plan = 'trial' AND c.trial_ends_at < NOW()))
    `
  );

  for (const company of expired) {
    const expiredAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;
    await db.query(`UPDATE companies SET subscription_status = 'expired', updated_at = NOW() WHERE id = ?`, [company.id]);
    if (company.company_email) {
      const emailContent = emailTemplates.subscriptionExpired(company.name, company.plan, expiredAt);
      await sendEmail(company.company_email, emailContent.subject, emailContent.html);
    }
  }
}

/* ================= CRON SCHEDULE ================= */
cron.schedule("*/3 * * * *", () => {
  repairBilling();
});

/* ================= MANUAL TRIGGER ================= */
router.get("/run", async (req, res) => {
  await repairBilling();
  res.json({ success: true, message: "Billing cron executed manually" });
});

export default router;
