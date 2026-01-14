import express from "express";
import cron from "node-cron";
import axios from "axios";
import { db } from "../config/db.js";
import { getZohoAccessToken } from "../services/zohoToken.service.js";
import { sendEmail } from "../utils/mailer.js";


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
        features: [
          'Valid for 15 Days',
          '100 Visitor Bookings',
          '100 Conference Bookings',
          '2 Conference Rooms'
        ]
      },
      business: {
        price: '₹500 / Month',
        features: [
          'Unlimited Visitors',
          '1000 Conference bookings',
          '6 Conference Rooms',
          'Dedicated Support'
        ]
      },
      enterprise: {
        price: 'Custom Pricing',
        features: [
          'Unlimited Visitors',
          'Unlimited Conference Bookings',
          'Unlimited Conference Rooms',
          'Dedicated Support'
        ]
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
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 40px 30px; }
            .success-icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
            .info-box { background: #f7f4ff; padding: 25px; margin: 25px 0; border-left: 4px solid #6a00ff; border-radius: 8px; }
            .info-row { display: flex; justify-content: space-between; margin: 12px 0; }
            .label { font-weight: 600; color: #555; }
            .value { color: #333; font-weight: 700; }
            .plan-badge { background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 8px 20px; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .features { background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 20px 0; }
            .features h3 { margin-top: 0; color: #6a00ff; font-size: 20px; }
            .features ul { list-style: none; padding: 0; margin: 10px 0; }
            .features li { padding: 10px 0; padding-left: 30px; position: relative; font-size: 15px; }
            .features li:before { content: "✓"; position: absolute; left: 0; color: #00c853; font-weight: bold; font-size: 18px; }
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
              <h2 style="text-align: center; color: #333;">Subscription Activated Successfully</h2>
              <p>Dear <strong>${companyName}</strong> Team,</p>
              <p>Great news! Your PROMEET subscription has been successfully activated and payment has been processed.</p>
              
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
                  <span class="label">Status:</span>
                  <span class="value" style="color: #00c853;">Active</span>
                </div>
                <div class="info-row">
                  <span class="label">Valid Until:</span>
                  <span class="value">${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Activated On:</span>
                  <span class="value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              <div class="features">
                <h3>✨ Your ${plan.toUpperCase()} Plan Includes:</h3>
                <ul>
                  ${currentPlan.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://promeet.zodopt.com'}" class="cta-button">Access Your Dashboard</a>
              </div>

              <p style="margin-top: 30px; color: #666;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
              <p><strong>PROMEET</strong> - Visitor & Conference Management System</p>
              <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
              <p style="font-size: 12px; color: #999; margin-top: 15px;">This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  upgradeCompleted: (companyName, fromPlan, toPlan, expiresAt) => {
    const planDetails = {
      trial: { price: '₹49 / 15 Days', features: ['100 Visitor Bookings', '100 Conference Bookings', '2 Conference Rooms'] },
      business: { price: '₹500 / Month', features: ['Unlimited Visitors', '1000 Conference bookings', '6 Conference Rooms', 'Dedicated Support'] },
      enterprise: { price: 'Custom Pricing', features: ['Unlimited Visitors', 'Unlimited Conference Bookings', 'Unlimited Conference Rooms', 'Dedicated Support'] }
    };

    const newPlan = planDetails[toPlan.toLowerCase()] || planDetails.business;

    return {
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
            .plan-badge { display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: bold; margin: 0 15px; font-size: 16px; }
            .old-plan { background: #e0e0e0; color: #666; }
            .new-plan { background: linear-gradient(135deg, #00c853, #00e676); color: white; }
            .arrow { color: #7a00ff; font-size: 28px; margin: 0 10px; }
            .info-box { background: #f7f4ff; padding: 25px; margin: 25px 0; border-left: 4px solid #7a00ff; border-radius: 8px; }
            .info-row { display: flex; justify-content: space-between; margin: 12px 0; }
            .label { font-weight: 600; color: #555; }
            .value { color: #333; font-weight: 700; }
            .features { background: #f0fff4; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00c853; }
            .features h3 { margin-top: 0; color: #00c853; font-size: 20px; }
            .features ul { list-style: none; padding: 0; margin: 10px 0; }
            .features li { padding: 10px 0; padding-left: 30px; position: relative; font-size: 15px; }
            .features li:before { content: "✓"; position: absolute; left: 0; color: #00c853; font-weight: bold; font-size: 18px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #7a00ff, #9500ff); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
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
              <h2 style="text-align: center; color: #333;">Plan Upgrade Successful</h2>
              <p>Dear <strong>${companyName}</strong> Team,</p>
              <p>Thank you for upgrading your PROMEET subscription! Your account has been successfully upgraded to the <strong>${toPlan.toUpperCase()}</strong> plan.</p>
              
              <div class="upgrade-flow">
                <span class="plan-badge old-plan">${fromPlan.toUpperCase()}</span>
                <span class="arrow">→</span>
                <span class="plan-badge new-plan">${toPlan.toUpperCase()}</span>
              </div>

              <div class="info-box">
                <div class="info-row">
                  <span class="label">New Plan:</span>
                  <span class="value" style="color: #00c853;">${toPlan.toUpperCase()}</span>
                </div>
                <div class="info-row">
                  <span class="label">Price:</span>
                  <span class="value">${newPlan.price}</span>
                </div>
                <div class="info-row">
                  <span class="label">Status:</span>
                  <span class="value" style="color: #00c853;">Active</span>
                </div>
                <div class="info-row">
                  <span class="label">Valid Until:</span>
                  <span class="value">${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Upgraded On:</span>
                  <span class="value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              <div class="features">
                <h3>🎁 New Features Unlocked:</h3>
                <ul>
                  ${newPlan.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://promeet.zodopt.com'}" class="cta-button">Explore Your New Features</a>
              </div>

              <p style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                💡 <strong>Pro Tip:</strong> Check out the Reports section to explore the enhanced features available in your ${toPlan.toUpperCase()} plan!
              </p>
            </div>
            <div class="footer">
              <p><strong>PROMEET</strong> - Visitor & Conference Management System</p>
              <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  subscriptionExpiring: (companyName, plan, expiresAt, daysLeft) => ({
    subject: `⚠️ Your PROMEET Subscription Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff9800, #ffa726); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .warning-icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
          .countdown-box { background: linear-gradient(135deg, #fff3e0, #ffe0b2); padding: 30px; margin: 25px 0; border-left: 4px solid #ff9800; border-radius: 8px; text-align: center; }
          .days-remaining { font-size: 48px; font-weight: bold; color: #ff9800; margin: 10px 0; }
          .info-box { background: #f7f4ff; padding: 25px; margin: 25px 0; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 12px 0; }
          .label { font-weight: 600; color: #555; }
          .value { color: #333; font-weight: 700; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff9800, #ffa726); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Subscription Expiring Soon</h1>
          </div>
          <div class="content">
            <div class="warning-icon">⚠️</div>
            <h2 style="text-align: center; color: #333;">Action Required</h2>
            <p>Dear <strong>${companyName}</strong> Team,</p>
            <p>This is a friendly reminder that your PROMEET subscription will expire soon.</p>
            
            <div class="countdown-box">
              <p style="margin: 0; font-size: 18px; color: #666;">Your subscription expires in:</p>
              <div class="days-remaining">${daysLeft}</div>
              <p style="margin: 0; font-size: 18px; color: #666; font-weight: bold;">${daysLeft === 1 ? 'Day' : 'Days'}</p>
            </div>

            <div class="info-box">
              <div class="info-row">
                <span class="label">Current Plan:</span>
                <span class="value">${plan.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Expiration Date:</span>
                <span class="value" style="color: #ff9800;">${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://promeet.zodopt.com'}/auth/subscription" class="cta-button">Renew Subscription Now</a>
            </div>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong> - Visitor & Conference Management System</p>
            <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff1744, #f50057); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .alert-icon { text-align: center; font-size: 60px; margin-bottom: 20px; }
          .alert-box { background: linear-gradient(135deg, #ffebee, #ffcdd2); padding: 25px; margin: 25px 0; border-left: 4px solid #ff1744; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 12px 0; }
          .label { font-weight: 600; color: #555; }
          .value { color: #333; font-weight: 700; }
          .expired-badge { background: #ff1744; color: white; padding: 8px 20px; border-radius: 25px; display: inline-block; font-weight: bold; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff1744, #f50057); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Subscription Expired</h1>
          </div>
          <div class="content">
            <div class="alert-icon">🔴</div>
            <h2 style="text-align: center; color: #333;">Your Subscription Has Expired</h2>
            <p>Dear <strong>${companyName}</strong> Team,</p>
            <p>Your PROMEET subscription has expired. To continue using our services, please renew your subscription immediately.</p>
            
            <div class="alert-box">
              <div class="info-row">
                <span class="label">Plan:</span>
                <span class="value">${plan.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Expired On:</span>
                <span class="value" style="color: #ff1744;">${new Date(expiredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div class="info-row">
                <span class="label">Status:</span>
                <span class="expired-badge">EXPIRED</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://promeet.zodopt.com'}/auth/subscription" class="cta-button">Renew Subscription</a>
            </div>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong> - Visitor & Conference Management System</p>
            <p>© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
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

  // Get companies with their admin user email
  const [companies] = await db.query(
    `
      SELECT 
        c.id,
        c.name,
        c.plan,
        c.zoho_customer_id,
        c.last_payment_link_id,
        c.pending_upgrade_plan,
        c.subscription_ends_at,
        c.trial_ends_at,
        c.subscription_status,
        u.email as company_email
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id
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
      GROUP BY c.id
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
    const { id, name, plan, zoho_customer_id, last_payment_link_id, pending_upgrade_plan, company_email } = company;

    console.log(`\n🏢 Checking Company → ${name} (${id})`);
    if (pending_upgrade_plan) {
      console.log(`📋 Pending Upgrade: ${plan} → ${pending_upgrade_plan}`);
    }

    if (!company_email) {
      console.warn(`⚠️ No email found for company ${name}, skipping email notification`);
    }

    try {
      const payRes = await axios.get(
        `https://www.zohoapis.in/billing/v1/paymentlinks/${last_payment_link_id}`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` }
        }
      );

      const payment = payRes?.data?.payment_link;
      if (!payment) {
        console.log("⚠ Payment link not found → skipping");
        continue;
      }

      const status = normalizeStatus(payment.status);
      console.log("🔍 Zoho Payment Status:", status);

      /* ================== PAYMENT SUCCESS ================== */
      if (status === "paid") {
        console.log("🎯 Payment Success — Activating company");

        let paidAt =
          payment?.paid_at ||
          payment?.updated_time ||
          payment?.created_time ||
          new Date().toISOString();

        let paidDate = new Date(paidAt);
        if (isNaN(paidDate.getTime())) {
          console.log("⚠ Invalid paid date, fallback → NOW");
          paidDate = new Date();
        }

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

        // Send email to company
        if (company_email) {
          try {
            if (pending_upgrade_plan) {
              console.log(`✅ UPGRADE COMPLETED: ${plan} → ${pending_upgrade_plan}`);
              const emailContent = emailTemplates.upgradeCompleted(name, plan, activePlan, mysqlEnds);
              await sendEmail(company_email, emailContent.subject, emailContent.html);
              console.log(`📧 Upgrade notification sent to ${company_email}`);
            } else {
              console.log("🎉 ACTIVATION + VALIDITY UPDATED SUCCESSFULLY");
              const emailContent = emailTemplates.subscriptionActivated(name, activePlan, mysqlEnds);
              await sendEmail(company_email, emailContent.subject, emailContent.html);
              console.log(`📧 Activation notification sent to ${company_email}`);
            }
          } catch (emailErr) {
            console.error("❌ Failed to send email:", emailErr.message);
          }
        }

        continue;
      }

      /* ================= FAILED / EXPIRED ================= */
      if (status === "expired" || status === "failed") {
        console.log("❌ Payment expired/failed");

        if (pending_upgrade_plan) {
          console.log("🔄 Clearing pending upgrade, keeping current plan");
          await db.query(`UPDATE companies SET pending_upgrade_plan=NULL, updated_at=NOW() WHERE id=?`, [id]);
        } else {
          console.log("⚠️ Marking subscription as pending");
          await db.query(`UPDATE companies SET subscription_status='pending', updated_at=NOW() WHERE id=?`, [id]);
        }

        continue;
      }

      console.log("⏳ Payment still pending — retry later...");
    } catch (err) {
      console.error("❌ CRON ERROR FOR COMPANY", name, err?.response?.data || err);
    }
  }

  /* ================= CHECK FOR EXPIRING/EXPIRED SUBSCRIPTIONS ================= */
  await checkExpiringSubscriptions();

  console.log("\n✅ CRON Billing Repair Completed\n");
}

/* ================= CHECK EXPIRING SUBSCRIPTIONS ================= */
async function checkExpiringSubscriptions() {
  console.log("\n⏰ Checking for expiring subscriptions...");

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const mysqlThreeDays = threeDaysFromNow.toISOString().slice(0, 19).replace("T", " ");

  // Check expiring subscriptions (3 days warning)
  const [expiring] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at, u.email as company_email
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id
      WHERE c.subscription_status = 'active'
      AND (
        (c.plan = 'business' AND c.subscription_ends_at BETWEEN NOW() AND ?)
        OR
        (c.plan = 'trial' AND c.trial_ends_at BETWEEN NOW() AND ?)
      )
      GROUP BY c.id
    `,
    [mysqlThreeDays, mysqlThreeDays]
  );

  for (const company of expiring) {
    if (!company.company_email) continue;

    const expiresAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;
    const daysLeft = Math.ceil((new Date(expiresAt) - now) / (1000 * 60 * 60 * 24));

    console.log(`⚠️ ${company.name} expires in ${daysLeft} days`);

    try {
      const emailContent = emailTemplates.subscriptionExpiring(company.name, company.plan, expiresAt, daysLeft);
      await sendEmail(company.company_email, emailContent.subject, emailContent.html);
      console.log(`📧 Expiring notification sent to ${company.company_email}`);
    } catch (err) {
      console.error(`❌ Failed to send expiring email for ${company.name}:`, err.message);
    }
  }

  // Check expired subscriptions
  const [expired] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at, u.email as company_email
      FROM companies c
      LEFT JOIN users u ON c.id = u.company_id
      WHERE c.subscription_status = 'active'
      AND (
        (c.plan = 'business' AND c.subscription_ends_at < NOW())
        OR
        (c.plan = 'trial' AND c.trial_ends_at < NOW())
      )
      GROUP BY c.id
    `
  );

  for (const company of expired) {
    const expiredAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;

    console.log(`🔴 ${company.name} subscription has expired`);

    await db.query(`UPDATE companies SET subscription_status = 'expired', updated_at = NOW() WHERE id = ?`, [company.id]);

    if (company.company_email) {
      try {
        const emailContent = emailTemplates.subscriptionExpired(company.name, company.plan, expiredAt);
        await sendEmail(company.company_email, emailContent.subject, emailContent.html);
        console.log(`📧 Expired notification sent to ${company.company_email}`);
      } catch (err) {
        console.error(`❌ Failed to send expired email for ${company.name}:`, err.message);
      }
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
