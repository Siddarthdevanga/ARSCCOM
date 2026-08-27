-- ======================================================
-- Migration: add-companies-auto-debit-active.sql
-- Purpose:   Tracks whether a Razorpay subscription is VERIFIED live and
--            charging, separate from razorpay_subscription_id merely
--            existing. An id gets written the moment createSubscription()
--            creates the Razorpay Subscription object, before the
--            customer has completed checkout/authorized the mandate --
--            trusting the id alone would wrongly hide the "Renew" button
--            for a company whose mandate was never actually authorized.
--            Set to 1 only by the subscription.activated/charged webhook
--            (real confirmation); set back to 0 by subscription.halted/
--            cancelled, and by self-serve cancellation.
-- Date:      2026-08-27
-- ======================================================

ALTER TABLE companies
  ADD COLUMN razorpay_auto_debit_active TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = verified live Razorpay auto-debit mandate (webhook-confirmed); 0 = none, never authorized, halted, or cancelled'
    AFTER razorpay_subscription_id;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN razorpay_auto_debit_active;
-- ------------------------------------------------------
