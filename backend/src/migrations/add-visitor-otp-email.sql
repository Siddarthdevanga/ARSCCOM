-- ============================================================
-- VISITOR OTP EMAIL SUPPORT - DATABASE MIGRATION
-- ============================================================
-- Purpose: Add email column to visitor_otp table to support email-based OTP
-- Date: 2026-03-30
-- ============================================================

-- Add email column to visitor_otp table
ALTER TABLE visitor_otp
ADD COLUMN email VARCHAR(255) NULL AFTER company_id,
ADD INDEX idx_email_company (email, company_id);

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- ALTER TABLE visitor_otp DROP COLUMN email;
-- ALTER TABLE visitor_otp DROP INDEX idx_email_company;
