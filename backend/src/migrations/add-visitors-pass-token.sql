-- ======================================================
-- Migration: add-visitors-pass-token.sql
-- Purpose:   The public visitor-pass page/API
--            (/v/pass?code=..., GET /api/visitors/public/code/:token)
--            was keyed by visitors.visitor_code, a plain sequential
--            value (e.g. COMP12-20260817-00001). Anyone holding one
--            pass link could enumerate every other visitor's name,
--            phone, email and photo for that company/day just by
--            incrementing the trailing counter — no auth required.
--            This adds a separate, unguessable random token used for
--            the public lookup instead. visitor_code is unchanged and
--            still shown on the pass as a human-readable label.
-- Date:      2026-08-17
-- ======================================================

ALTER TABLE visitors
  ADD COLUMN pass_token VARCHAR(48) NULL UNIQUE
    COMMENT 'crypto.randomBytes(24).toString(hex) — used for public pass lookup instead of the guessable visitor_code'
    AFTER response_token;

-- ------------------------------------------------------
-- Rollback (if ever needed):
-- ALTER TABLE visitors DROP COLUMN pass_token;
-- ------------------------------------------------------
