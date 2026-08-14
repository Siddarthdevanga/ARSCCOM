-- ============================================================
-- RAZORPAY PAYMENT-LINK SIGNUP — REGISTRATION STATE
-- ============================================================
-- Purpose: support a second account-creation channel where a company
-- pays first via a Razorpay Payment Link (collecting only Name/Email/
-- Phone) before any registration form is filled in. These companies
-- start with subscription_status='trial' directly (payment already
-- happened) but need a follow-up "complete registration" step to
-- collect the real company name, logo and WhatsApp URL — this is
-- what registration_source/registration_complete track.
--
-- razorpay_payment_id is a UNIQUE backstop against Razorpay webhook
-- redelivery creating two companies for the same payment (the webhook
-- handler inserts using this column rather than a check-then-insert
-- race on email/phone).
--
-- must_change_password lives on users (not companies) since it's a
-- per-login-credential concern — set when a temp password is issued,
-- generic enough to reuse for a future admin-triggered password reset
-- too, not exclusive to the Razorpay flow.
-- Date: 2026-08-13
-- ============================================================

ALTER TABLE companies
  ADD COLUMN registration_source ENUM('web','razorpay') NOT NULL DEFAULT 'web'
    COMMENT 'web = full registration form; razorpay = paid first via landing-page payment link, profile filled in afterward'
    AFTER subscription_status,
  ADD COLUMN registration_complete TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '0 = razorpay-sourced company still needs real name/logo/whatsapp filled in via /auth/complete-registration'
    AFTER registration_source,
  ADD COLUMN razorpay_payment_id VARCHAR(64) NULL UNIQUE
    COMMENT 'Razorpay payment entity id — UNIQUE backstop against duplicate webhook deliveries creating two companies for one payment'
    AFTER registration_complete;

ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Forces a password change on next login — set for Razorpay-issued temp passwords, generic enough for future admin-reset use too'
    AFTER password_hash;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN registration_source, DROP COLUMN registration_complete, DROP COLUMN razorpay_payment_id;
-- ALTER TABLE users DROP COLUMN must_change_password;
