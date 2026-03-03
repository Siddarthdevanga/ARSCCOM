import { db } from "../config/db.js";
import bcrypt from "bcrypt";

/* ── Inlined from conference routes (not exported from a controller file) ── */
const PLAN_ROOM_LIMITS = { trial: 2, business: 6, enterprise: Infinity };

const syncRoomActivationByPlan = async (companyId, plan) => {
  const limit = PLAN_ROOM_LIMITS[(plan || "trial").toLowerCase()] ?? 2;

  await db.execute(
    `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
    [companyId]
  );

  if (limit === Infinity) {
    await db.execute(
      `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
      [companyId]
    );
    return;
  }

  if (limit > 0) {
    await db.execute(
      `UPDATE conference_rooms SET is_active = 1
       WHERE id IN (
         SELECT id FROM (
           SELECT id FROM conference_rooms
           WHERE company_id = ?
           ORDER BY room_number ASC, id ASC
           LIMIT ?
         ) AS t
       )`,
      [companyId, limit]
    );
  }
};

/* ======================================================
   SUPERADMIN LOGIN
====================================================== */
export const superAdminLogin = async ({ email, password }) => {
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error("Email and password are required");
  }

  const [rows] = await db.execute(
    `SELECT id, email, name, password_hash, role, is_active
     FROM users
     WHERE email = ? AND role = 'superadmin'
     LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length) throw new Error("Invalid credentials");

  const user = rows[0];

  if (!user.is_active) throw new Error("Account is inactive. Contact support.");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: "superadmin",
  };
};

/* ======================================================
   DASHBOARD — aggregated counts per company
====================================================== */
export const getDashboard = async () => {
  const [rows] = await db.execute(
    `SELECT
       c.id,
       c.name,
       c.slug,
       c.plan,
       c.subscription_status,
       c.is_suspended,
       c.trial_ends_at,
       c.subscription_ends_at,
       c.created_at,
       (SELECT COUNT(*) FROM conference_rooms  cr WHERE cr.company_id = c.id) AS total_rooms,
       (SELECT COUNT(*) FROM conference_bookings cb WHERE cb.company_id = c.id) AS total_bookings,
       (SELECT COUNT(*) FROM visitors          v  WHERE v.company_id  = c.id) AS total_visitors,
       (SELECT COUNT(*) FROM users             u  WHERE u.company_id  = c.id) AS total_users
     FROM companies c
     ORDER BY c.created_at DESC`
  );

  return rows;
};

/* ======================================================
   SINGLE COMPANY DETAIL
====================================================== */
export const getCompanyDetail = async (companyId) => {
  const [[company]] = await db.execute(
    `SELECT
       c.*,
       (SELECT COUNT(*) FROM conference_rooms  cr WHERE cr.company_id = c.id) AS total_rooms,
       (SELECT COUNT(*) FROM conference_bookings cb WHERE cb.company_id = c.id) AS total_bookings,
       (SELECT COUNT(*) FROM visitors          v  WHERE v.company_id  = c.id) AS total_visitors,
       (SELECT COUNT(*) FROM users             u  WHERE u.company_id  = c.id) AS total_users
     FROM companies c
     WHERE c.id = ?
     LIMIT 1`,
    [companyId]
  );

  if (!company) throw new Error("Company not found");
  return company;
};

/* ======================================================
   UPDATE PLAN
   Changes plan + syncs room activation
====================================================== */
export const updatePlan = async (companyId, plan) => {
  const validPlans = ["trial", "business", "enterprise"];
  if (!validPlans.includes(plan)) throw new Error("Invalid plan");

  await db.execute(
    `UPDATE companies SET plan = ?, updated_at = NOW() WHERE id = ?`,
    [plan, companyId]
  );

  // Sync room activation to match new plan limits
  await syncRoomActivationByPlan(companyId, plan);
};

/* ======================================================
   UPDATE SUBSCRIPTION STATUS
====================================================== */
export const updateSubscriptionStatus = async (companyId, status) => {
  const validStatuses = ["pending", "trial", "active", "cancelled", "expired"];
  if (!validStatuses.includes(status)) throw new Error("Invalid subscription status");

  await db.execute(
    `UPDATE companies SET subscription_status = ?, updated_at = NOW() WHERE id = ?`,
    [status, companyId]
  );
};

/* ======================================================
   EXTEND TRIAL
====================================================== */
export const extendTrial = async (companyId, trialEndsAt) => {
  if (!trialEndsAt) throw new Error("trial_ends_at date is required");

  const date = new Date(trialEndsAt);
  if (isNaN(date.getTime())) throw new Error("Invalid date format");

  await db.execute(
    `UPDATE companies
     SET trial_ends_at = ?, subscription_status = 'trial', updated_at = NOW()
     WHERE id = ?`,
    [trialEndsAt, companyId]
  );
};

/* ======================================================
   UPDATE SUBSCRIPTION DATES
====================================================== */
export const updateSubscriptionDates = async (companyId, { subscription_start, subscription_ends_at }) => {
  if (!subscription_ends_at) throw new Error("subscription_ends_at is required");

  const endDate = new Date(subscription_ends_at);
  if (isNaN(endDate.getTime())) throw new Error("Invalid subscription_ends_at date");

  let sql, params;

  if (subscription_start) {
    const startDate = new Date(subscription_start);
    if (isNaN(startDate.getTime())) throw new Error("Invalid subscription_start date");

    sql = `UPDATE companies
           SET subscription_ends_at = ?, updated_at = NOW()
           WHERE id = ?`;
    params = [subscription_ends_at, companyId];
  } else {
    sql = `UPDATE companies
           SET subscription_ends_at = ?, updated_at = NOW()
           WHERE id = ?`;
    params = [subscription_ends_at, companyId];
  }

  await db.execute(sql, params);
};

/* ======================================================
   FORCE CANCEL SUBSCRIPTION
====================================================== */
export const forceCancel = async (companyId) => {
  await db.execute(
    `UPDATE companies
     SET subscription_status = 'cancelled',
         pending_upgrade_plan = NULL,
         updated_at = NOW()
     WHERE id = ?`,
    [companyId]
  );
};

/* ======================================================
   SUSPEND / UNSUSPEND COMPANY
====================================================== */
export const setSuspension = async (companyId, suspend) => {
  await db.execute(
    `UPDATE companies SET is_suspended = ?, updated_at = NOW() WHERE id = ?`,
    [suspend ? 1 : 0, companyId]
  );
};

/* ======================================================
   FORGOT PASSWORD (superadmin — no company JOIN)
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email is required");

  const [rows] = await db.execute(
    `SELECT id, reset_last_sent FROM users
     WHERE email = ? AND role = 'superadmin' LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length) return { sent: true }; // don't leak

  const user = rows[0];

  // 30s cooldown
  if (user.reset_last_sent) {
    const [[wait]] = await db.query(
      `SELECT GREATEST(0, 30 - TIMESTAMPDIFF(SECOND, reset_last_sent, NOW())) AS w
       FROM users WHERE id = ?`,
      [user.id]
    );
    if (wait.w > 0) return { sent: false, waitSeconds: wait.w };
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  await db.execute(
    `UPDATE users
     SET reset_code = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE), reset_last_sent = NOW()
     WHERE id = ?`,
    [code, user.id]
  );

  // Send email
  const { sendEmail } = await import("../utils/mailer.js");
  await sendEmail({
    to: cleanEmail,
    subject: "PROMEET SuperAdmin — Password Reset Code",
    html: `
      <p>Hello <b>SuperAdmin</b>,</p>
      <p>Your password reset code is:</p>
      <div style="background:#f8f9ff;border-left:4px solid #6c2bd9;padding:20px;margin:20px 0;text-align:center;">
        <h2 style="color:#6c2bd9;margin:0;letter-spacing:4px;font-size:32px;">${code}</h2>
      </div>
      <p>Valid for <b>10 minutes</b>. Do not share this code.</p>
    `,
  }).catch(console.error);

  return { sent: true };
};

/* ======================================================
   RESET PASSWORD (superadmin)
====================================================== */
export const resetPassword = async ({ email, code, password }) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !code || !password) throw new Error("All fields required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const [rows] = await db.execute(
    `SELECT id, reset_code FROM users
     WHERE email = ? AND role = 'superadmin' AND reset_expires > NOW() LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length || rows[0].reset_code !== code.toUpperCase()) {
    throw new Error("Invalid or expired reset code");
  }

  const hash = await bcrypt.hash(password, 10);

  await db.execute(
    `UPDATE users
     SET password_hash = ?, reset_code = NULL, reset_expires = NULL, reset_last_sent = NULL
     WHERE id = ?`,
    [hash, rows[0].id]
  );
};

/* ======================================================
   DELETE COMPANY (full cascade, FK-safe)
====================================================== */
export const deleteCompany = async (companyId) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Verify company exists
    const [[company]] = await conn.execute(
      `SELECT id FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!company) throw new Error("Company not found");

    // 1. visitor_otp (linked to visitors via phone/email, safest to delete by company visitors)
    await conn.execute(
      `DELETE vo FROM visitor_otp vo
       INNER JOIN visitors v ON v.phone = vo.phone
       WHERE v.company_id = ?`,
      [companyId]
    );

    // 2. public_booking_otp (linked to company slug/id)
    await conn.execute(
      `DELETE FROM public_booking_otp WHERE company_id = ?`,
      [companyId]
    );

    // 3. visitors
    await conn.execute(
      `DELETE FROM visitors WHERE company_id = ?`,
      [companyId]
    );

    // 4. conference_bookings
    await conn.execute(
      `DELETE FROM conference_bookings WHERE company_id = ?`,
      [companyId]
    );

    // 5. conference_rooms
    await conn.execute(
      `DELETE FROM conference_rooms WHERE company_id = ?`,
      [companyId]
    );

    // 6. upgrade_requests (if linked)
    await conn.execute(
      `DELETE FROM upgrade_requests WHERE company_id = ?`,
      [companyId]
    ).catch(() => {}); // table may not have company_id FK, ignore if fails

    // 7. webhook_events (if linked)
    await conn.execute(
      `DELETE FROM webhook_events WHERE company_id = ?`,
      [companyId]
    ).catch(() => {});

    // 8. password_resets for users of this company
    await conn.execute(
      `UPDATE users SET reset_code = NULL, reset_expires = NULL, reset_last_sent = NULL
       WHERE company_id = ?`,
      [companyId]
    );

    // 9. users
    await conn.execute(
      `DELETE FROM users WHERE company_id = ?`,
      [companyId]
    );

    // 10. company
    await conn.execute(
      `DELETE FROM companies WHERE id = ?`,
      [companyId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
