import { db } from "../config/db.js";
import bcrypt from "bcrypt";
import { syncRoomActivationByPlan } from "../controllers/conferenceBooking.controller.js";

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
