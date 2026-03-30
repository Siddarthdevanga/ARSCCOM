-- Migration: Add 'grace_period' to subscription_status ENUM
-- This allows the subscription_status column to accept 'grace_period' as a valid value

-- Step 1: Modify the ENUM to include 'grace_period'
ALTER TABLE companies
MODIFY COLUMN subscription_status ENUM(
  'pending',
  'trial',
  'active',
  'grace_period',
  'expired',
  'cancelled'
) DEFAULT 'pending'
COMMENT 'Subscription status: pending, trial, active, grace_period (10-day buffer), expired, or cancelled';

-- Verify the change
-- Run this to check: SHOW COLUMNS FROM companies LIKE 'subscription_status';
