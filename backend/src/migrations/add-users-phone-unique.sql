-- ============================================================
-- UNIQUE INDEX ON users.phone
-- ============================================================
-- Purpose: login now accepts phone as an alternative identifier to
-- email (needed for the Razorpay payment-link signup flow, where the
-- temp password is sent to whichever channel the person checks
-- first). A non-unique phone column would make "look up the account
-- by phone" ambiguous.
--
-- MySQL allows multiple NULLs under a UNIQUE index without conflict,
-- so existing rows with no phone are unaffected. Empty-string phone
-- values WOULD collide with each other under this index — run the
-- pre-checks below first and resolve any hits before applying.
--
-- Pre-checks (run manually against the live DB before this migration):
--   SELECT phone, COUNT(*) FROM users GROUP BY phone HAVING COUNT(*) > 1;
--   SELECT COUNT(*) FROM users WHERE phone = '';
-- Date: 2026-08-13
-- ============================================================

ALTER TABLE users ADD UNIQUE INDEX idx_users_phone (phone);

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE users DROP INDEX idx_users_phone;
