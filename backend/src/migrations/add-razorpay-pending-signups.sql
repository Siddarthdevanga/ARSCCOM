-- ============================================================
-- RAZORPAY PRE-PAYMENT SIGNUP POPUP
-- ============================================================
-- Purpose: Razorpay's hosted checkout for our payment link only ever
-- reliably collects a phone number — never email or name. Since the
-- account we create needs an email (for login and the welcome email),
-- the landing page now shows our own popup (Name/Email/Phone) before
-- redirecting to Razorpay, storing what was entered here so the
-- payment_link.paid webhook (which only carries a phone number) can
-- look the submission back up by phone and pull the real name/email
-- from it, rather than trusting Razorpay's own payload for those.
--
-- consumed_at is set once a webhook successfully matches this row,
-- so a second payment against the same unconsumed phone doesn't
-- reuse a stale submission.
-- Date: 2026-08-14
-- ============================================================

CREATE TABLE razorpay_pending_signups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(10) NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_unconsumed (phone, consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- DROP TABLE razorpay_pending_signups;
