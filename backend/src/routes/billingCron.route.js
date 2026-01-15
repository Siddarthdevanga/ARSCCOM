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
      subject: `🎉 Your PROMEET ${plan.toUpperCase()} Subscription is Now Active!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f7fa; }
            .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
            .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.95; }
            .content { padding: 40px 30px; }
            .success-icon { text-align: center; font-size: 64px; margin-bottom: 20px; }
            .greeting { font-size: 18px; margin-bottom: 20px; }
            .info-box { background: linear-gradient(135deg, #f7f4ff, #faf7ff); padding: 25px; margin: 25px 0; border-left: 4px solid #6a00ff; border-radius: 8px; }
            .info-row { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; padding: 10px 0; border-bottom: 1px solid #e8e4f0; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #555; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { color: #333; font-weight: 700; font-size: 16px; }
            .plan-badge { background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 8px 20px; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 14px; }
            .features { background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0; }
            .features h3 { margin-top: 0; color: #6a00ff; font-size: 20px; }
            .features ul { list-style: none; padding: 0; margin: 0; }
            .features li { padding: 12px 0; padding-left: 35px; position: relative; font-size: 15px; }
            .features li:before { content: "✓"; position: absolute; left: 0; color: #00c853; font-weight: bold; font-size: 20px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #6a00ff, #8a2dff); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(106, 0, 255, 0.3); }
            .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
            .footer strong { color: #6a00ff; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to PROMEET!</h1>
              <p>Your subscription is now active and ready to use</p>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2 style="text-align: center; color: #6a00ff; margin-bottom: 10px;">Subscription Activated Successfully</h2>
              <p class="greeting">Dear <strong>${companyName}</strong> Team,</p>
              <p>Congratulations! Your PROMEET subscription has been successfully activated. You now have full access to all features included in your plan.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Plan</span>
                  <span class="plan-badge">${plan.toUpperCase()}</span>
                </div>
                <div class="info-row">
                  <span class="label">Price</span>
                  <span class="value">${currentPlan.price}</span>
                </div>
                <div class="info-row">
                  <span class="label">Valid Until</span>
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
                <p style="margin-bottom: 20px; font-size: 16px;">Ready to get started?</p>
                <a href="https://www.promeet.zodopt.com" class="cta-button">Access Dashboard →</a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
                If you have any questions, our support team is here to help!
              </p>
            </div>
            <div class="footer">
              <p><strong>PROMEET</strong> - Visitor & Conference Management Platform</p>
              <p style="margin-top: 10px;">© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },

  upgradeCompleted: (companyName, fromPlan, toPlan, expiresAt) => ({
    subject: `🚀 Congratulations! You've Upgraded to ${toPlan.toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f7fa; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #7a00ff, #9500ff); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
          .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.95; }
          .content { padding: 40px 30px; }
          .upgrade-icon { text-align: center; font-size: 64px; margin-bottom: 20px; }
          .celebration { text-align: center; font-size: 48px; margin: 20px 0; }
          .upgrade-flow { text-align: center; margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #f9f9f9, #f0f0f0); border-radius: 10px; }
          .plan-badge { display: inline-block; padding: 12px 24px; border-radius: 25px; font-weight: bold; margin: 0 15px; font-size: 16px; }
          .old-plan { background: #e0e0e0; color: #666; }
          .new-plan { background: linear-gradient(135deg, #00c853, #00e676); color: white; box-shadow: 0 4px 15px rgba(0, 200, 83, 0.3); }
          .arrow { color: #7a00ff; font-size: 32px; margin: 0 10px; font-weight: bold; }
          .info-box { background: linear-gradient(135deg, #f7f4ff, #faf7ff); padding: 25px; margin: 25px 0; border-left: 4px solid #7a00ff; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; }
          .label { font-weight: 600; color: #555; font-size: 14px; text-transform: uppercase; }
          .value { color: #333; font-weight: 700; font-size: 16px; }
          .footer { background: #f4f4f4; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .footer strong { color: #7a00ff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <p>Your plan has been successfully upgraded</p>
          </div>
          <div class="content">
            <div class="upgrade-icon">🚀</div>
            <div class="celebration">✨ 🎊 ✨</div>
            <h2 style="text-align: center; color: #7a00ff; margin-bottom: 20px;">Plan Upgrade Successful</h2>
            <p style="font-size: 16px;">Dear <strong>${companyName}</strong> Team,</p>
            <p style="font-size: 16px;">Great news! Your account has been successfully upgraded to the <strong style="color: #00c853;">${toPlan.toUpperCase()}</strong> plan. You now have access to more features and capabilities.</p>
            
            <div class="upgrade-flow">
              <span class="plan-badge old-plan">${fromPlan.toUpperCase()}</span>
              <span class="arrow">→</span>
              <span class="plan-badge new-plan">${toPlan.toUpperCase()}</span>
            </div>

            <div class="info-box">
              <div class="info-row">
                <span class="label">New Plan</span>
                <span class="value" style="color: #00c853;">${toPlan.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="label">Valid Until</span>
                <span class="value">${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>

            <p style="margin-top: 30px; font-size: 15px; color: #666; text-align: center;">
              Thank you for choosing PROMEET. We're excited to support your growth!
            </p>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong> - Visitor & Conference Management Platform</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
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
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f7fa; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff9800, #ffa726); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .warning-icon { text-align: center; font-size: 64px; margin-bottom: 20px; }
          .countdown-box { background: linear-gradient(135deg, #fff3e0, #ffe0b2); padding: 30px; margin: 25px 0; border-radius: 10px; text-align: center; border: 2px solid #ff9800; }
          .days-remaining { font-size: 56px; font-weight: bold; color: #ff9800; margin: 15px 0; }
          .countdown-label { font-size: 20px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .urgency-message { background: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; border-radius: 8px; margin: 20px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff9800, #ffa726); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3); }
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
            <h2 style="text-align: center; color: #ff9800; margin-bottom: 20px;">Action Required</h2>
            <p style="font-size: 16px;">Dear <strong>${companyName}</strong> Team,</p>
            <p style="font-size: 16px;">This is a friendly reminder that your PROMEET <strong>${plan.toUpperCase()}</strong> subscription will expire soon.</p>
            
            <div class="countdown-box">
              <p style="margin: 0; font-size: 18px; color: #666;">Your subscription expires in:</p>
              <div class="days-remaining">${daysLeft}</div>
              <p class="countdown-label">${daysLeft === 1 ? 'Day' : 'Days'}</p>
            </div>

            <div class="urgency-message">
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ff6f00;">
                ⏳ Don't lose access to your valuable data and features!
              </p>
              <p style="margin: 10px 0 0; font-size: 14px; color: #666;">
                Renew now to ensure uninterrupted service and continue managing your visitors and conference bookings seamlessly.
              </p>
            </div>

            <div style="text-align: center;">
              <p style="margin-bottom: 20px; font-size: 16px; font-weight: 600;">Renew your subscription today:</p>
              <a href="https://www.promeet.zodopt.com/dashboard/subscription" class="cta-button">Renew Subscription →</a>
            </div>

            <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Questions? Contact our support team at <a href="mailto:support@promeet.zodopt.com" style="color: #ff9800;">support@promeet.zodopt.com</a>
            </p>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong> - Visitor & Conference Management Platform</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
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
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f7fa; }
          .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff1744, #f50057); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
          .content { padding: 40px 30px; }
          .alert-icon { text-align: center; font-size: 64px; margin-bottom: 20px; }
          .alert-box { background: linear-gradient(135deg, #ffebee, #ffcdd2); padding: 25px; margin: 25px 0; border-left: 4px solid #ff1744; border-radius: 8px; }
          .expired-badge { background: #ff1744; color: white; padding: 10px 25px; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 23, 68, 0.3); }
          .impact-list { background: #fff; padding: 20px; border: 2px solid #ffcdd2; border-radius: 8px; margin: 20px 0; }
          .impact-list h4 { margin-top: 0; color: #ff1744; font-size: 18px; }
          .impact-list ul { list-style: none; padding: 0; }
          .impact-list li { padding: 8px 0; padding-left: 25px; position: relative; color: #666; }
          .impact-list li:before { content: "✗"; position: absolute; left: 0; color: #ff1744; font-weight: bold; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #ff1744, #f50057); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(255, 23, 68, 0.3); }
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
            <h2 style="text-align: center; color: #ff1744; margin-bottom: 20px;">Your Subscription Has Expired</h2>
            <p style="font-size: 16px;">Dear <strong>${companyName}</strong> Team,</p>
            <p style="font-size: 16px;">Your PROMEET <strong>${plan.toUpperCase()}</strong> subscription expired on <strong>${new Date(expiredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>
            
            <div class="alert-box">
              <p style="margin: 0; text-align: center; font-size: 16px;">
                <strong>Current Status:</strong>
              </p>
              <p style="text-align: center; margin: 15px 0;">
                <span class="expired-badge">EXPIRED</span>
              </p>
            </div>

            <div class="impact-list">
              <h4>⚠️ Limited Access</h4>
              <p style="margin: 5px 0 15px; color: #666; font-size: 14px;">You currently have restricted access to:</p>
              <ul>
                <li>Visitor Management</li>
                <li>Conference Room Bookings</li>
                <li>QR Code Generation</li>
                <li>Email Notifications</li>
                <li>Dashboard & Reports</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="margin-bottom: 20px; font-size: 16px; font-weight: 600; color: #ff1744;">
                🔄 Renew now to restore full access!
              </p>
              <a href="https://www.promeet.zodopt.com/dashboard/subscription" class="cta-button">Renew Subscription →</a>
            </div>

            <p style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; font-size: 14px; color: #666; text-align: center;">
              <strong>Need help?</strong><br/>
              Contact our support team at <a href="mailto:support@promeet.zodopt.com" style="color: #ff1744; text-decoration: none;">support@promeet.zodopt.com</a><br/>
              or call us at <strong>+91-8647878785</strong>
            </p>
          </div>
          <div class="footer">
            <p><strong>PROMEET</strong> - Visitor & Conference Management Platform</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} PROMEET. All rights reserved.</p>
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
            
            console.log(`📧 Preparing to send email to ${company_email}`);
            console.log(`   Subject: ${emailContent.subject}`);
            
            await sendEmail({
              to: company_email,
              subject: emailContent.subject,
              html: emailContent.html
            });
            
            console.log(`✅ Email sent successfully to ${company_email}`);
          } catch (emailErr) {
            console.error(`❌ Email failed for ${name}:`, emailErr.message);
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

/* ================= CHECK EXPIRING SUBSCRIPTIONS WITH EMAIL TRACKING ================= */
async function checkExpiringSubscriptions() {
  console.log("\n⏰ Checking for expiring subscriptions...");
  
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const mysqlThreeDays = threeDaysFromNow.toISOString().slice(0, 19).replace("T", " ");

  /* ================= EXPIRING SOON (3 DAYS WARNING) ================= */
  const [expiring] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at, 
             c.expiry_warning_sent_at,
             (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) as company_email
      FROM companies c
      WHERE c.subscription_status = 'active'
      AND (
        (c.plan = 'business' AND c.subscription_ends_at BETWEEN NOW() AND ?)
        OR
        (c.plan = 'trial' AND c.trial_ends_at BETWEEN NOW() AND ?)
      )
      AND (c.expiry_warning_sent_at IS NULL OR c.expiry_warning_sent_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))
    `,
    [mysqlThreeDays, mysqlThreeDays]
  );

  for (const company of expiring) {
    if (!company.company_email) {
      console.log(`⚠️ ${company.name} has no email, skipping notification`);
      continue;
    }
    
    const expiresAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;
    const daysLeft = Math.ceil((new Date(expiresAt) - now) / (1000 * 60 * 60 * 24));

    console.log(`⚠️ ${company.name} expires in ${daysLeft} days - sending warning`);

    try {
      const emailContent = emailTemplates.subscriptionExpiring(company.name, company.plan, expiresAt, daysLeft);
      
      console.log(`📧 Preparing expiring warning email for ${company.name}`);
      console.log(`   To: ${company.company_email}`);
      console.log(`   Subject: ${emailContent.subject}`);
      
      await sendEmail({
        to: company.company_email,
        subject: emailContent.subject,
        html: emailContent.html
      });
      
      // Mark as sent to prevent duplicate emails
      await db.query(
        `UPDATE companies SET expiry_warning_sent_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [company.id]
      );
      
      console.log(`✅ Expiring notification sent to ${company.company_email}`);
    } catch (err) {
      console.error(`❌ Failed to send expiring email for ${company.name}:`, err.message);
      console.error(`   Error details:`, err);
    }
  }

  /* ================= EXPIRED SUBSCRIPTIONS ================= */
  const [expired] = await db.query(
    `
      SELECT c.id, c.name, c.plan, c.subscription_ends_at, c.trial_ends_at,
             c.expiry_email_sent_at,
             (SELECT u.email FROM users u WHERE u.company_id = c.id LIMIT 1) as company_email
      FROM companies c
      WHERE c.subscription_status = 'active'
      AND (
        (c.plan = 'business' AND c.subscription_ends_at < NOW())
        OR
        (c.plan = 'trial' AND c.trial_ends_at < NOW())
      )
      AND c.expiry_email_sent_at IS NULL
    `
  );

  for (const company of expired) {
    const expiredAt = company.plan === 'business' ? company.subscription_ends_at : company.trial_ends_at;

    console.log(`🔴 ${company.name} subscription has expired`);

    // Mark as expired
    await db.query(
      `UPDATE companies SET subscription_status = 'expired', updated_at = NOW() WHERE id = ?`,
      [company.id]
    );

    if (company.company_email) {
      try {
        const emailContent = emailTemplates.subscriptionExpired(company.name, company.plan, expiredAt);
        
        console.log(`📧 Preparing expired email for ${company.name}`);
        console.log(`   To: ${company.company_email}`);
        console.log(`   Subject: ${emailContent.subject}`);
        
        await sendEmail({
          to: company.company_email,
          subject: emailContent.subject,
          html: emailContent.html
        });
        
        // Mark email as sent to prevent duplicates
        await db.query(
          `UPDATE companies SET expiry_email_sent_at = NOW(), updated_at = NOW() WHERE id = ?`,
          [company.id]
        );
        
        console.log(`✅ Expired notification sent to ${company.company_email}`);
      } catch (err) {
        console.error(`❌ Failed to send expired email for ${company.name}:`, err.message);
        console.error(`   Error details:`, err);
      }
    } else {
      console.log(`⚠️ ${company.name} has no email, skipping notification`);
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
