-- ============================================================
-- DROP razorpay_pending_signups
-- ============================================================
-- Purpose: the Razorpay trial signup switched from a Payment Link
-- (which only ever returned a phone number in webhooks, requiring a
-- pre-payment popup + staging table to capture email/name ourselves)
-- to a Razorpay Payment Page, which collects Name/Email/Phone
-- natively and returns them directly in the payment.captured
-- webhook. The staging table and popup are no longer needed.
-- Date: 2026-08-14
-- ============================================================

DROP TABLE IF EXISTS razorpay_pending_signups;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- See the original add-razorpay-pending-signups.sql in git history
-- for the CREATE TABLE statement if this ever needs to come back.
