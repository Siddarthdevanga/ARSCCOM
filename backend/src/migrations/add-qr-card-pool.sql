-- ============================================================
-- QR CARD POOL (claimable blank visiting cards)
-- ============================================================
-- Purpose: the superadmin prints batches of blank cards (Haivisitor
-- front, QR back) and the team hands them out. Whoever scans one first
-- claims it by filling in their details; it then works as their digital
-- visiting card with no login. When they later pay for any plan, and the
-- account's email or phone matches the claim, the card moves into that
-- company with its scans and leads.
--
-- Pool cards live in digital_cards, like every other card, so the public
-- page, vCard, photo proxy, scan counter and share-back form all work on
-- them unchanged. The state of a pool card is derived, never stored:
--
--   unclaimed   source = 'pool' AND claimed_at IS NULL
--   claimed     source = 'pool' AND claimed_at IS NOT NULL AND company_id IS NULL
--   converted   source = 'pool' AND company_id IS NOT NULL
--   disabled    source = 'pool' AND is_active = 0   (overrides the above)
--
-- Date: 2026-09-29
-- ============================================================

CREATE TABLE IF NOT EXISTS card_batches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL COMMENT 'Internal name, e.g. Bangalore Expo',
  header      VARCHAR(160) NULL COMMENT 'Printed at the top of each A4 sheet; never on the cards',
  quantity    INT NOT NULL,
  created_by  INT NULL COMMENT 'superadmin user id',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- An unclaimed card has no owner, name or phone yet.
ALTER TABLE digital_cards
  MODIFY company_id INT NULL,
  MODIFY name       VARCHAR(120) NULL,
  MODIFY phone      VARCHAR(20)  NULL;

ALTER TABLE digital_cards
  ADD COLUMN source         ENUM('company','pool') NOT NULL DEFAULT 'company' AFTER company_id,
  ADD COLUMN batch_id       INT NULL AFTER source,
  ADD COLUMN serial_no      INT NULL COMMENT 'Position within the batch, printed under the QR' AFTER batch_id,
  ADD COLUMN claimed_at     DATETIME NULL AFTER serial_no,
  ADD COLUMN converted_at   DATETIME NULL AFTER claimed_at,
  -- Last 10 digits of the claimer's phone, for "one card per person" and
  -- for matching a later registration, whatever format either was typed in.
  ADD COLUMN claim_phone10  CHAR(10) NULL AFTER converted_at,
  -- A claimed card has no company, so it carries its own logo. Kept after
  -- conversion so the web card does not change under the owner's feet.
  ADD COLUMN own_logo_url   VARCHAR(255) NULL AFTER photo_url,
  -- When the owner was last sent a "someone shared their details" teaser;
  -- at most one a day.
  ADD COLUMN teaser_sent_at DATETIME NULL,
  ADD CONSTRAINT fk_digital_cards_batch
    FOREIGN KEY (batch_id) REFERENCES card_batches(id) ON DELETE SET NULL,
  ADD INDEX idx_cards_pool (source, claimed_at),
  ADD INDEX idx_cards_batch (batch_id),
  ADD INDEX idx_cards_claim_phone (claim_phone10),
  ADD INDEX idx_cards_email (email);

-- Leads on a claimed card belong to no company until it converts.
ALTER TABLE card_leads
  MODIFY company_id INT NULL;

-- ============================================================
-- VERIFY
-- ============================================================
-- SHOW COLUMNS FROM digital_cards;
-- SHOW COLUMNS FROM card_batches;
-- SHOW COLUMNS FROM card_leads LIKE 'company_id';

-- ============================================================
-- ROLLBACK (only while no pool cards exist)
-- ============================================================
-- ALTER TABLE digital_cards DROP FOREIGN KEY fk_digital_cards_batch;
-- ALTER TABLE digital_cards
--   DROP INDEX idx_cards_pool, DROP INDEX idx_cards_batch,
--   DROP INDEX idx_cards_claim_phone, DROP INDEX idx_cards_email,
--   DROP COLUMN source, DROP COLUMN batch_id, DROP COLUMN serial_no,
--   DROP COLUMN claimed_at, DROP COLUMN converted_at, DROP COLUMN claim_phone10,
--   DROP COLUMN own_logo_url, DROP COLUMN teaser_sent_at;
-- ALTER TABLE digital_cards MODIFY company_id INT NOT NULL, MODIFY name VARCHAR(120) NOT NULL, MODIFY phone VARCHAR(20) NOT NULL;
-- ALTER TABLE card_leads MODIFY company_id INT NOT NULL;
-- DROP TABLE card_batches;
