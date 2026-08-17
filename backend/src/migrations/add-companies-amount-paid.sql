-- ============================================================
-- COMPANIES.AMOUNT_PAID
-- ============================================================
-- Purpose: surface how much a Razorpay landing-page trial signup
-- actually paid, in the Superadmin dashboard's new "Razorpay Payment
-- Source" tab. Stored in paise (Razorpay's own convention) at company
-- creation time in the payment.captured webhook — NULL for web/Zoho
-- -sourced companies, which have never stored a paid-amount anywhere
-- (price there is always derived on the fly from plan+billing_interval).
-- Date: 2026-08-17
-- ============================================================

ALTER TABLE companies
  ADD COLUMN amount_paid INT NULL
    COMMENT 'Amount paid in paise via Razorpay (landing-page trial signup); NULL for web/Zoho-sourced companies'
    AFTER razorpay_payment_id;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE companies DROP COLUMN amount_paid;
