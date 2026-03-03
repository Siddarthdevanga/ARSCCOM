import { db } from "../config/db.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../utils/mailer.js";

/* ======================================================
   CONSTANTS & HELPERS
====================================================== */
const PLAN_ROOM_LIMITS = { trial: 2, business: 6, enterprise: Infinity };

const toSlug = (str) =>
  str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ======================================================
   SYNC ROOM ACTIVATION BY PLAN
   — called after every plan change
   — LIMIT must be inlined as integer literal;
     MySQL rejects bound ? params for LIMIT in subqueries
====================================================== */
const syncRoomActivationByPlan = async (companyId, plan) => {
  const limit = PLAN_ROOM_LIMITS[(plan || "trial").toLowerCase()] ?? 2;

  await db.query(
    `UPDATE conference_rooms SET is_active = 0 WHERE company_id = ?`,
    [companyId]
  );

  if (limit === Infinity) {
    await db.query(
      `UPDATE conference_rooms SET is_active = 1 WHERE company_id = ?`,
      [companyId]
    );
    return;
  }

  if (limit > 0) {
    const safeLimit = parseInt(limit, 10);
    await db.query(
      `UPDATE conference_rooms SET is_active = 1
       WHERE id IN (
         SELECT id FROM (
           SELECT id FROM conference_rooms
           WHERE company_id = ?
           ORDER BY room_number ASC, id ASC
           LIMIT ${safeLimit}
         ) AS t
       )`,
      [companyId]
    );
  }
};

/* ======================================================
   SUPERADMIN LOGIN
====================================================== */
export const superAdminLogin = async ({ email, password }) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !password) throw new Error("Email and password are required");

  const [rows] = await db.query(
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

  return { id: user.id, email: user.email, name: user.name, role: "superadmin" };
};

/* ======================================================
   DASHBOARD — aggregated counts per company
====================================================== */
export const getDashboard = async () => {
  const [rows] = await db.query(
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
       (SELECT COUNT(*) FROM conference_rooms    cr WHERE cr.company_id = c.id) AS total_rooms,
       (SELECT COUNT(*) FROM conference_bookings cb WHERE cb.company_id = c.id) AS total_bookings,
       (SELECT COUNT(*) FROM visitors             v  WHERE v.company_id  = c.id) AS total_visitors,
       (SELECT COUNT(*) FROM users                u  WHERE u.company_id  = c.id) AS total_users
     FROM companies c
     ORDER BY c.created_at DESC`
  );
  return rows;
};

/* ======================================================
   SINGLE COMPANY DETAIL
====================================================== */
export const getCompanyDetail = async (companyId) => {
  const [rows] = await db.query(
    `SELECT
       c.*,
       (SELECT COUNT(*) FROM conference_rooms    cr WHERE cr.company_id = c.id) AS total_rooms,
       (SELECT COUNT(*) FROM conference_bookings cb WHERE cb.company_id = c.id) AS total_bookings,
       (SELECT COUNT(*) FROM visitors             v  WHERE v.company_id  = c.id) AS total_visitors,
       (SELECT COUNT(*) FROM users                u  WHERE u.company_id  = c.id) AS total_users
     FROM companies c
     WHERE c.id = ?
     LIMIT 1`,
    [companyId]
  );

  if (!rows.length) throw new Error("Company not found");
  return rows[0];
};

/* ======================================================
   GET COMPANY USERS — for Edit tab email picker
====================================================== */
export const getCompanyUsers = async (companyId) => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, is_active
     FROM users
     WHERE company_id = ?
     ORDER BY id ASC`,
    [companyId]
  );
  return rows;
};

/* ======================================================
   UPDATE COMPANY
   Supports: name (+ auto slug), company ID (cascaded), user email
====================================================== */
export const updateCompany = async (companyId, { newCompanyId, name, userEmail, newUserEmail }) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [companyRows] = await conn.query(
      `SELECT id, name, slug FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!companyRows.length) throw new Error("Company not found");
    const company = companyRows[0];

    // ── 1. Update name + auto-generate slug ─────────────────
    if (name && name.trim() !== company.name) {
      const newSlug = toSlug(name);

      const [slugConflict] = await conn.query(
        `SELECT id FROM companies WHERE slug = ? AND id != ? LIMIT 1`,
        [newSlug, companyId]
      );
      if (slugConflict.length)
        throw new Error(`Slug "${newSlug}" is already in use by another company`);

      await conn.query(
        `UPDATE companies SET name = ?, slug = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), newSlug, companyId]
      );
    }

    // ── 2. Update user email ─────────────────────────────────
    if (userEmail && newUserEmail) {
      const cleanOld = userEmail.trim().toLowerCase();
      const cleanNew = newUserEmail.trim().toLowerCase();

      if (cleanOld !== cleanNew) {
        const [conflict] = await conn.query(
          `SELECT id FROM users WHERE email = ? LIMIT 1`,
          [cleanNew]
        );
        if (conflict.length) throw new Error("Email already in use by another account");

        const [result] = await conn.query(
          `UPDATE users SET email = ? WHERE email = ? AND company_id = ?`,
          [cleanNew, cleanOld, companyId]
        );
        if (result.affectedRows === 0)
          throw new Error("User not found in this company with that email");
      }
    }

    // ── 3. Change company ID (full cascade) ──────────────────
    if (newCompanyId && Number(newCompanyId) !== Number(companyId)) {
      const nid = Number(newCompanyId);

      const [idConflict] = await conn.query(
        `SELECT id FROM companies WHERE id = ? LIMIT 1`,
        [nid]
      );
      if (idConflict.length) throw new Error(`Company ID ${nid} is already in use`);

      await conn.query(`SET FOREIGN_KEY_CHECKS = 0`);

      for (const table of [
        "users",
        "conference_rooms",
        "conference_bookings",
        "visitors",
        "visitor_otp",
        "public_booking_otp",
        "upgrade_requests",
        "webhook_events",
      ]) {
        await conn.query(
          `UPDATE \`${table}\` SET company_id = ? WHERE company_id = ?`,
          [nid, companyId]
        ).catch(() => {});
      }

      await conn.query(
        `UPDATE companies SET id = ?, updated_at = NOW() WHERE id = ?`,
        [nid, companyId]
      );

      await conn.query(`SET FOREIGN_KEY_CHECKS = 1`);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ======================================================
   UPDATE PLAN + sync room activation
====================================================== */
export const updatePlan = async (companyId, plan) => {
  const validPlans = ["trial", "business", "enterprise"];
  if (!validPlans.includes(plan)) throw new Error("Invalid plan");

  await db.query(
    `UPDATE companies SET plan = ?, updated_at = NOW() WHERE id = ?`,
    [plan, companyId]
  );

  await syncRoomActivationByPlan(companyId, plan);
};

/* ======================================================
   UPDATE SUBSCRIPTION STATUS
====================================================== */
export const updateSubscriptionStatus = async (companyId, status) => {
  const validStatuses = ["pending", "trial", "active", "cancelled", "expired"];
  if (!validStatuses.includes(status)) throw new Error("Invalid subscription status");

  await db.query(
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

  await db.query(
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

  if (subscription_start) {
    const startDate = new Date(subscription_start);
    if (isNaN(startDate.getTime())) throw new Error("Invalid subscription_start date");
  }

  await db.query(
    `UPDATE companies SET subscription_ends_at = ?, updated_at = NOW() WHERE id = ?`,
    [subscription_ends_at, companyId]
  );
};

/* ======================================================
   FORCE CANCEL SUBSCRIPTION
====================================================== */
export const forceCancel = async (companyId) => {
  await db.query(
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
  await db.query(
    `UPDATE companies SET is_suspended = ?, updated_at = NOW() WHERE id = ?`,
    [suspend ? 1 : 0, companyId]
  );
};

/* ======================================================
   FORGOT PASSWORD
====================================================== */
export const forgotPassword = async (email) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email is required");

  const [rows] = await db.query(
    `SELECT id, reset_last_sent FROM users
     WHERE email = ? AND role = 'superadmin' LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length) return { sent: true };

  const user = rows[0];

  if (user.reset_last_sent) {
    const [wait] = await db.query(
      `SELECT GREATEST(0, 30 - TIMESTAMPDIFF(SECOND, reset_last_sent, NOW())) AS w
       FROM users WHERE id = ?`,
      [user.id]
    );
    if (wait[0].w > 0) return { sent: false, waitSeconds: wait[0].w };
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  await db.query(
    `UPDATE users
     SET reset_code = ?,
         reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
         reset_last_sent = NOW()
     WHERE id = ?`,
    [code, user.id]
  );

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
   RESET PASSWORD
====================================================== */
export const resetPassword = async ({ email, code, password }) => {
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail || !code || !password) throw new Error("All fields required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const [rows] = await db.query(
    `SELECT id, reset_code FROM users
     WHERE email = ? AND role = 'superadmin' AND reset_expires > NOW() LIMIT 1`,
    [cleanEmail]
  );

  if (!rows.length || rows[0].reset_code !== code.toUpperCase())
    throw new Error("Invalid or expired reset code");

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `UPDATE users
     SET password_hash = ?,
         reset_code = NULL,
         reset_expires = NULL,
         reset_last_sent = NULL
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

    const [check] = await conn.query(
      `SELECT id FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    if (!check.length) throw new Error("Company not found");

    // 1. visitor_otp
    await conn.query(`DELETE FROM visitor_otp WHERE company_id = ?`, [companyId]);

    // 2. public_booking_otp
    await conn.query(`DELETE FROM public_booking_otp WHERE company_id = ?`, [companyId]);

    // 3. visitors
    await conn.query(`DELETE FROM visitors WHERE company_id = ?`, [companyId]);

    // 4. conference_bookings — MUST come before rooms (FK: room_id → conference_rooms.id)
    await conn.query(`DELETE FROM conference_bookings WHERE company_id = ?`, [companyId]);

    // 4b. safety net: orphaned bookings linked via room_id with no company_id
    await conn.query(
      `DELETE cb FROM conference_bookings cb
       INNER JOIN conference_rooms cr ON cr.id = cb.room_id
       WHERE cr.company_id = ?`,
      [companyId]
    ).catch(() => {});

    // 5. conference_rooms
    await conn.query(`DELETE FROM conference_rooms WHERE company_id = ?`, [companyId]);

    // 6. upgrade_requests
    await conn.query(
      `DELETE FROM upgrade_requests WHERE company_id = ?`, [companyId]
    ).catch(() => {});

    // 7. webhook_events
    await conn.query(
      `DELETE FROM webhook_events WHERE company_id = ?`, [companyId]
    ).catch(() => {});

    // 8. password_resets (linked via user_id)
    await conn.query(
      `DELETE pr FROM password_resets pr
       INNER JOIN users u ON u.id = pr.user_id
       WHERE u.company_id = ?`,
      [companyId]
    ).catch(() => {});

    // 9. users
    await conn.query(`DELETE FROM users WHERE company_id = ?`, [companyId]);

    // 10. company
    await conn.query(`DELETE FROM companies WHERE id = ?`, [companyId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
