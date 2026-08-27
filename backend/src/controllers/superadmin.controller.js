import jwt from "jsonwebtoken";
import * as service from "../services/superadmin.service.js";
import { db } from "../config/db.js";
import { sendImageWhatsApp, sendVideoWhatsApp, registerOptIn } from "../services/gupshup.service.js";
import * as razorpayService from "../services/razorpay.service.js";

const JWT_EXPIRY = "12h";

/* ======================================================
   FORGOT PASSWORD
   POST /api/superadmin/forgot-password
====================================================== */
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    await service.forgotPassword(email);
    return res.status(200).json({ success: true, message: "If the email exists, a reset code has been sent" });
  } catch (err) {
    console.error("SUPERADMIN FORGOT PASSWORD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   RESET PASSWORD
   POST /api/superadmin/reset-password
====================================================== */
export const resetPassword = async (req, res) => {
  try {
    const email    = req.body?.email?.trim().toLowerCase();
    const code     = req.body?.code?.trim();
    const password = req.body?.password?.trim();

    if (!email || !code || !password)
      return res.status(400).json({ success: false, message: "Email, code and password are required" });

    await service.resetPassword({ email, code, password });
    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("SUPERADMIN RESET PASSWORD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   LOGIN
   POST /api/superadmin/login
====================================================== */
export const login = async (req, res) => {
  try {
    const email    = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required" });

    const user = await service.superAdminLogin({ email, password });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return res.status(200).json({ success: false, message: "Invalid credentials" });
  }
};

/* ======================================================
   CREATE SUB-ADMIN (read-only, Landing Page Conversions only)
   POST /api/superadmin/sub-admins — full superadmin only
====================================================== */
export const createSubAdmin = async (req, res) => {
  try {
    const name     = req.body?.name?.trim();
    const email    = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const subAdmin = await service.createSubAdmin({ name, email, password });
    return res.status(201).json({ success: true, message: "Sub-admin created", subAdmin });
  } catch (err) {
    console.error("SUPERADMIN CREATE SUB-ADMIN ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   DASHBOARD
   GET /api/superadmin/dashboard
====================================================== */
export const dashboard = async (req, res) => {
  try {
    const companies = await service.getDashboard();
    return res.status(200).json({ success: true, companies });
  } catch (err) {
    console.error("SUPERADMIN DASHBOARD ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
};

/* ======================================================
   RAZORPAY PAYMENT SOURCE
   GET /api/superadmin/razorpay-signups
====================================================== */
export const razorpaySignups = async (req, res) => {
  try {
    const signups = await service.getRazorpaySignups();
    return res.status(200).json({ success: true, signups });
  } catch (err) {
    console.error("SUPERADMIN RAZORPAY SIGNUPS ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load Razorpay signups" });
  }
};

/* ======================================================
   RESEND RAZORPAY TEMP PASSWORD
   POST /api/superadmin/razorpay-signups/:id/resend-password
====================================================== */
export const resendRazorpayPassword = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await razorpayService.resendTrialPassword(companyId);
    return res.status(200).json({ success: true, message: "Temp password resent" });
  } catch (err) {
    console.error("SUPERADMIN RESEND RAZORPAY PASSWORD ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   MANUAL SEND — ONBOARDING NURTURE MESSAGE
   POST /api/superadmin/razorpay-signups/:id/send-onboarding-message
   body: { day: 1 | 5 | 7 | 10 | 12 }
====================================================== */
export const sendOnboardingNurtureManual = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const day = parseInt(req.body?.day);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (isNaN(day))        return res.status(400).json({ success: false, message: "day is required" });

    await service.sendOnboardingNurtureManual(companyId, day);
    return res.status(200).json({ success: true, message: `Day ${day} message sent` });
  } catch (err) {
    console.error("SUPERADMIN SEND ONBOARDING MESSAGE ERROR:", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/* ======================================================
   COMPANY DETAIL
   GET /api/superadmin/companies/:id
====================================================== */
export const companyDetail = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const company = await service.getCompanyDetail(companyId);
    return res.status(200).json({ success: true, company });
  } catch (err) {
    console.error("SUPERADMIN COMPANY DETAIL ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   COMPANY USERS
   GET /api/superadmin/companies/:id/users
====================================================== */
export const companyUsers = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const users = await service.getCompanyUsers(companyId);
    return res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("SUPERADMIN COMPANY USERS ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE COMPANY
   PATCH /api/superadmin/companies/:id/update
   body: { name?, newCompanyId?, userEmail?, newUserEmail? }
====================================================== */
export const updateCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    const { name, newCompanyId, userEmail, newUserEmail } = req.body;

    if (!name && !newCompanyId && !(userEmail && newUserEmail))
      return res.status(400).json({ success: false, message: "At least one field to update is required" });

    if (newCompanyId && isNaN(parseInt(newCompanyId)))
      return res.status(400).json({ success: false, message: "Invalid new company ID" });

    if ((userEmail && !newUserEmail) || (!userEmail && newUserEmail))
      return res.status(400).json({ success: false, message: "Both userEmail and newUserEmail are required to update email" });

    await service.updateCompany(companyId, { name, newCompanyId, userEmail, newUserEmail });
    return res.status(200).json({ success: true, message: "Company updated successfully" });
  } catch (err) {
    console.error("SUPERADMIN UPDATE COMPANY ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE PLAN
   PATCH /api/superadmin/companies/:id/plan
   body: { plan: "trial" | "business" | "enterprise" }
====================================================== */
export const updatePlan = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { plan }  = req.body;

    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!plan)             return res.status(400).json({ success: false, message: "plan is required" });

    const normalizedPlan = plan.toLowerCase();
    await service.updatePlan(companyId, normalizedPlan);

    // WhatsApp notification for business or enterprise
    const templateKey = normalizedPlan === "business"
      ? "GUPSHUP_BUSINESS_ACTIVATED_TEMPLATE"
      : normalizedPlan === "enterprise"
        ? "GUPSHUP_ENTERPRISE_ACK_TEMPLATE"
        : null;

    if (templateKey && process.env[templateKey]) {
      try {
        const [[row]] = await db.query(
          `SELECT u.phone, c.name FROM users u JOIN companies c ON c.id = u.company_id
           WHERE u.company_id = ? AND u.role = 'user' AND u.is_active = 1 LIMIT 1`,
          [companyId]
        );
        if (row?.phone) {
          const { sendWhatsAppTemplate } = await import("../services/gupshup.service.js");
          const d = String(row.phone).replace(/\D/g, "");
          const phone = d.length === 10 ? `91${d}` : d;
          await sendWhatsAppTemplate(phone, process.env[templateKey], [row.name]);
          console.log(`[SUPERADMIN] ${normalizedPlan} WhatsApp sent to ${row.phone}`);
        }
      } catch (e) {
        console.error(`[SUPERADMIN] ${normalizedPlan} WhatsApp failed:`, e.message);
      }
    }

    return res.status(200).json({ success: true, message: `Plan updated to ${plan}` });
  } catch (err) {
    console.error("SUPERADMIN UPDATE PLAN ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE SUBSCRIPTION STATUS
   PATCH /api/superadmin/companies/:id/status
   body: { status: "pending" | "trial" | "active" | "grace_period" | "cancelled" | "expired", endsAt?: "2026-12-31" }
   endsAt is required when activating a company whose trial_ends_at /
   subscription_ends_at has already lapsed (or was never set).
====================================================== */
export const updateStatus = async (req, res) => {
  try {
    const companyId  = parseInt(req.params.id);
    const { status, endsAt } = req.body;

    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!status)           return res.status(400).json({ success: false, message: "status is required" });

    await service.updateSubscriptionStatus(companyId, status.toLowerCase(), endsAt || null);
    return res.status(200).json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error("SUPERADMIN UPDATE STATUS ERROR:", err.message);
    const httpStatus = err.message === "Company not found" ? 404 : 400;
    return res.status(httpStatus).json({ success: false, message: err.message });
  }
};

/* ======================================================
   EXTEND / CLEAR TRIAL END DATE
   PATCH /api/superadmin/companies/:id/extend-trial
   body: { trial_ends_at: "2025-12-31" }  → set/extend the date
   body: { trial_ends_at: null }           → remove the date
   body: {}                                → remove the date (field omitted)
====================================================== */
export const extendTrial = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId))
      return res.status(400).json({ success: false, message: "Invalid company ID" });

    // null / undefined / "" all mean "clear the trial end date"
    const raw           = req.body?.trial_ends_at;
    const trial_ends_at = (raw === null || raw === undefined || raw === "")
      ? null
      : raw.toString().trim();

    if (trial_ends_at !== null) {
      const parsed = new Date(trial_ends_at);
      if (isNaN(parsed.getTime()))
        return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const { warnings } = await service.extendTrial(companyId, trial_ends_at);

    // WhatsApp — trial activated (only when setting a date, not clearing)
    if (trial_ends_at) {
      const activatedTemplate = process.env.GUPSHUP_TRIAL_ACTIVATED_TEMPLATE || "";
      if (activatedTemplate) {
        try {
          const [[row]] = await db.query(
            `SELECT u.phone, c.name FROM users u JOIN companies c ON c.id = u.company_id
             WHERE u.company_id = ? AND u.role = 'user' AND u.is_active = 1 LIMIT 1`,
            [companyId]
          );
          if (row?.phone) {
            const prettyExpiry = new Date(trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
            const { sendWhatsAppTemplate } = await import("../services/gupshup.service.js");
            const digits = String(row.phone).replace(/\D/g, "");
            const phone  = digits.length === 10 ? `91${digits}` : digits;
            await sendWhatsAppTemplate(phone, activatedTemplate, [row.name, prettyExpiry]);
            await db.query(`UPDATE companies SET wa_reminders_sent = '' WHERE id = ?`, [companyId]);
            console.log(`[SUPERADMIN] Trial activated WhatsApp sent to ${row.phone}`);
          }
        } catch (e) {
          console.error(`[SUPERADMIN] Trial activated WhatsApp failed:`, e.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: trial_ends_at === null ? "Trial end date removed" : `Trial extended to ${trial_ends_at}`,
      warnings: warnings?.length ? warnings : undefined,
    });
  } catch (err) {
    console.error("SUPERADMIN EXTEND TRIAL ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   UPDATE SUBSCRIPTION DATES
   PATCH /api/superadmin/companies/:id/subscription-dates
   body: { subscription_ends_at: "2025-12-31", subscription_start?: "2025-01-01" }
====================================================== */
export const updateSubscriptionDates = async (req, res) => {
  try {
    const companyId                                    = parseInt(req.params.id);
    const { subscription_ends_at, subscription_start } = req.body;

    if (isNaN(companyId))      return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (!subscription_ends_at) return res.status(400).json({ success: false, message: "subscription_ends_at is required" });

    const { warnings } = await service.updateSubscriptionDates(companyId, { subscription_ends_at, subscription_start });
    return res.status(200).json({
      success: true,
      message: "Subscription dates updated",
      warnings: warnings?.length ? warnings : undefined,
    });
  } catch (err) {
    console.error("SUPERADMIN UPDATE DATES ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   SET GRACE PERIOD
   PATCH /api/superadmin/companies/:id/grace-period
   body: { enable: true, days?: 10 }   → start grace period
   body: { enable: false }              → clear grace period
====================================================== */
export const setGracePeriod = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { enable, days = 10 } = req.body;

    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });
    if (enable === undefined) return res.status(400).json({ success: false, message: "enable is required" });

    await service.setGracePeriod(companyId, enable, days);

    const message = enable
      ? `Grace period set for ${days} days`
      : "Grace period cleared";

    return res.status(200).json({ success: true, message });
  } catch (err) {
    console.error("SUPERADMIN SET GRACE PERIOD ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   FORCE CANCEL
   POST /api/superadmin/companies/:id/force-cancel
====================================================== */
export const forceCancel = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.forceCancel(companyId);
    return res.status(200).json({ success: true, message: "Subscription force cancelled" });
  } catch (err) {
    console.error("SUPERADMIN FORCE CANCEL ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   SUSPEND / UNSUSPEND
   POST /api/superadmin/companies/:id/suspend
   POST /api/superadmin/companies/:id/unsuspend
====================================================== */
export const suspendCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.setSuspension(companyId, true);
    return res.status(200).json({ success: true, message: "Company suspended" });
  } catch (err) {
    console.error("SUPERADMIN SUSPEND ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const unsuspendCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.setSuspension(companyId, false);
    return res.status(200).json({ success: true, message: "Company unsuspended" });
  } catch (err) {
    console.error("SUPERADMIN UNSUSPEND ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   DELETE COMPANY
   DELETE /api/superadmin/companies/:id
====================================================== */
export const deleteCompany = async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (isNaN(companyId)) return res.status(400).json({ success: false, message: "Invalid company ID" });

    await service.deleteCompany(companyId);
    return res.status(200).json({ success: true, message: "Company and all related data permanently deleted" });
  } catch (err) {
    console.error("SUPERADMIN DELETE COMPANY ERROR:", err.message);
    const status = err.message === "Company not found" ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/* ======================================================
   BULK OPT-IN ALL EXISTING WHATSAPP LEADS
   POST /api/superadmin/bulk-optin-leads
====================================================== */
export const bulkOptInLeads = async (_req, res) => {
  try {
    const [leads] = await db.query(`SELECT phone FROM whatsapp_leads WHERE unsubscribed = 0 OR unsubscribed IS NULL`);
    let success = 0, failed = 0;
    for (const lead of leads) {
      try {
        await registerOptIn(lead.phone);
        await db.query(`UPDATE whatsapp_leads SET optin_registered_at = NOW() WHERE phone = ?`, [lead.phone]);
        success++;
      } catch {
        failed++;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return res.json({ success: true, message: `Opt-in registered: ${success}, failed: ${failed}`, total: leads.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   SEND VIDEO WHATSAPP BROADCAST
   POST /api/superadmin/send-video-message
   body: { phones: string, videoUrl: string, message: string }
====================================================== */
export const sendVideoMessage = async (req, res) => {
  try {
    const { phones, videoUrl, message, mediaType = "image" } = req.body;

    if (!phones || !videoUrl || !message) {
      return res.status(400).json({ success: false, message: "phones, videoUrl and message are required" });
    }

    const phoneList = phones
      .split(/[\n,]+/)
      .map((p) => p.trim().replace(/\D/g, ""))
      .filter((p) => p.length >= 10);

    if (phoneList.length === 0) {
      return res.status(400).json({ success: false, message: "No valid phone numbers provided" });
    }

    // Only send to leads who have opted-in (messaged the bot at least once)
    const normalised = phoneList.map(p => p.length === 10 ? `91${p}` : p);
    const placeholders = normalised.map(() => "?").join(",");
    const [optedIn] = await db.query(
      `SELECT phone FROM whatsapp_leads WHERE phone IN (${placeholders}) AND opted_in = 1`,
      normalised
    );
    const optedInSet = new Set(optedIn.map(r => r.phone));

    const results = { sent: [], failed: [], skipped: [] };
    const sender = mediaType === "video" ? sendVideoWhatsApp : sendImageWhatsApp;

    for (const rawPhone of phoneList) {
      const destination = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
      if (!optedInSet.has(destination)) {
        results.skipped.push(destination);
        continue;
      }
      try {
        await sender(destination, videoUrl, message);
        results.sent.push(destination);
      } catch (e) {
        console.error(`[BROADCAST] Failed for ${destination}:`, e.message);
        results.failed.push({ phone: destination, error: e.message });
      }
    }

    return res.json({
      success: true,
      message: `Sent: ${results.sent.length}, Failed: ${results.failed.length}`,
      results,
    });
  } catch (err) {
    console.error("SEND VIDEO MESSAGE ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   WHATSAPP LEADS
   GET /api/superadmin/whatsapp-leads
====================================================== */
export const whatsappLeads = async (req, res) => {
  try {
    const [leads] = await db.query(
      `SELECT
         wl.id, wl.phone, wl.name, wl.last_action, wl.created_at, wl.updated_at,
         wl.nurture_step, wl.last_nurture_sent_at,
         wl.pre_nurture_step, wl.last_pre_nurture_sent_at,
         wl.unsubscribed,
         da.id         AS demo_id,
         da.app_date   AS demo_date,
         da.app_time   AS demo_time,
         da.attended   AS demo_attended,
         da.post_demo_sent,
         EXISTS(
           SELECT 1 FROM users u
           JOIN companies c ON c.id = u.company_id
           WHERE (
             u.phone COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
             OR CONCAT('91', u.phone) COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
             OR u.phone COLLATE utf8mb4_unicode_ci = RIGHT(wl.phone, 10) COLLATE utf8mb4_unicode_ci
           )
             AND c.subscription_status NOT IN ('expired','suspended')
             AND u.role = 'user'
         ) AS is_converted,
         (SELECT c.plan FROM users u JOIN companies c ON c.id = u.company_id
          WHERE (
            u.phone COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR CONCAT('91', u.phone) COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR u.phone COLLATE utf8mb4_unicode_ci = RIGHT(wl.phone, 10) COLLATE utf8mb4_unicode_ci
          ) AND u.role = 'user' LIMIT 1
         ) AS company_plan,
         (SELECT c.subscription_status FROM users u JOIN companies c ON c.id = u.company_id
          WHERE (
            u.phone COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR CONCAT('91', u.phone) COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR u.phone COLLATE utf8mb4_unicode_ci = RIGHT(wl.phone, 10) COLLATE utf8mb4_unicode_ci
          ) AND u.role = 'user' LIMIT 1
         ) AS company_sub_status,
         (SELECT c.payment_nurture_step FROM users u JOIN companies c ON c.id = u.company_id
          WHERE (
            u.phone COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR CONCAT('91', u.phone) COLLATE utf8mb4_unicode_ci = wl.phone COLLATE utf8mb4_unicode_ci
            OR u.phone COLLATE utf8mb4_unicode_ci = RIGHT(wl.phone, 10) COLLATE utf8mb4_unicode_ci
          ) AND u.role = 'user' LIMIT 1
         ) AS company_payment_nurture_step
       FROM whatsapp_leads wl
       LEFT JOIN demo_appointments da
         ON da.phone = wl.phone
         AND da.id = (
           SELECT id FROM demo_appointments
           WHERE phone = wl.phone
           ORDER BY created_at DESC LIMIT 1
         )
       ORDER BY wl.updated_at DESC`
    );
    return res.status(200).json({ success: true, leads });
  } catch (err) {
    console.error("SUPERADMIN WHATSAPP LEADS ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ======================================================
   MARK DEMO ATTENDED
   POST /api/superadmin/demo-appointments/:id/mark-attended
====================================================== */
export const markDemoAttended = async (req, res) => {
  try {
    const demoId = parseInt(req.params.id);
    if (isNaN(demoId)) return res.status(400).json({ success: false, message: "Invalid demo ID" });

    const [[appt]] = await db.query(
      `SELECT id, name, phone, attended, post_demo_sent FROM demo_appointments WHERE id = ?`,
      [demoId]
    );
    if (!appt) return res.status(404).json({ success: false, message: "Appointment not found" });

    await db.query(`UPDATE demo_appointments SET attended = 1 WHERE id = ?`, [demoId]);

    // Immediately send attended follow-up if not yet sent
    if (!appt.post_demo_sent) {
      const attendedTemplate = process.env.GUPSHUP_DEMO_ATTENDED_TEMPLATE || "";
      if (attendedTemplate) {
        try {
          const { sendWhatsAppTemplate } = await import("../services/gupshup.service.js");
          await sendWhatsAppTemplate(appt.phone, attendedTemplate, [appt.name || "there"]);
          await db.query(`UPDATE demo_appointments SET post_demo_sent = 1 WHERE id = ?`, [demoId]);
          console.log(`[MARK ATTENDED] Follow-up sent to ${appt.phone}`);
        } catch (e) {
          console.error(`[MARK ATTENDED] WhatsApp failed:`, e.message);
        }
      }
    }

    return res.json({ success: true, message: "Marked as attended" });
  } catch (err) {
    console.error("MARK ATTENDED ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

