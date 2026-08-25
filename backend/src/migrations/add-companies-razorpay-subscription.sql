-- ======================================================
-- Migration: add-companies-razorpay-subscription.sql
-- Purpose:   Full replacement of Zoho Payment Links with real Razorpay
--            Subscriptions (auto-debit) for Business/Enterprise. Existing
--            subscription_status/plan/billing_interval/subscription_ends_at/
--            pending_upgrade_plan/pending_billing_interval columns are
--            reused as-is — only two new columns are needed, since
--            Razorpay's own subscription.charged/halted/cancelled webhook
--            events map onto that same existing state machine (and the
--            existing gracePeriodCron already handles "ends_at has passed"
--            regardless of which gateway set it).
-- Date:      2026-08-25
-- ======================================================

ALTER TABLE companies
  ADD COLUMN razorpay_customer_id VARCHAR(64) NULL
    COMMENT 'Razorpay Customer id — created once per company on first subscription'
    AFTER zoho_customer_id,
  ADD COLUMN razorpay_subscription_id VARCHAR(64) NULL UNIQUE
    COMMENT 'Current/most recent Razorpay Subscription id for this company'
    AFTER razorpay_customer_id;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE companies DROP COLUMN razorpay_customer_id, DROP COLUMN razorpay_subscription_id;
-- ------------------------------------------------------
