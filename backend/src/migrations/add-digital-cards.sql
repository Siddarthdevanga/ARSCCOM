-- ============================================================
-- DIGITAL VISITING CARDS
-- ============================================================
-- Purpose: per-employee digital visiting cards. The company admin
-- creates and edits them; each card has a permanent public URL that
-- anyone can open by scanning a QR, with no login. A scanner can save
-- the contact, open WhatsApp, and optionally leave their own details.
--
-- Three tables:
--   digital_cards  the card itself, one row per employee
--   card_scans     one row per unique viewer per day, for the counter
--   card_leads     details a scanner chose to share back
--
-- Date: 2026-09-28
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_cards (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  company_id      INT NOT NULL,

  -- Random and permanent. Printed QR codes point here forever, so this
  -- is never regenerated and the row is never hard-deleted.
  slug            VARCHAR(24) NOT NULL UNIQUE
                  COMMENT 'Random public identifier; permanent once issued',

  -- Core fields. These map onto a vCard so "Save Contact" produces a
  -- proper entry rather than a name and a blob of text.
  name            VARCHAR(120) NOT NULL,
  job_title       VARCHAR(120) NULL,
  company_name    VARCHAR(160) NULL COMMENT 'Defaults to the company name, overridable per card',
  phone           VARCHAR(20)  NOT NULL,
  -- NULL means "same as phone". Stored rather than derived so a later
  -- change to phone does not silently change the WhatsApp number.
  whatsapp        VARCHAR(20)  NULL,
  email           VARCHAR(190) NULL,
  linkedin        VARCHAR(255) NULL,
  brief           TEXT NULL,
  photo_url       VARCHAR(255) NULL,

  -- Two free slots. Display-only: vCard has nowhere to put them.
  custom1_label   VARCHAR(60)  NULL,
  custom1_value   VARCHAR(255) NULL,
  custom1_type    ENUM('text','link') NOT NULL DEFAULT 'text',
  custom2_label   VARCHAR(60)  NULL,
  custom2_value   VARCHAR(255) NULL,
  custom2_type    ENUM('text','link') NOT NULL DEFAULT 'text',

  theme           VARCHAR(32) NOT NULL DEFAULT 'ink',
  bg_color        VARCHAR(9) NULL COMMENT 'Set only when the admin overrides the theme',
  text_color      VARCHAR(9) NULL,
  accent_color    VARCHAR(9) NULL,

  -- A card is never deleted, so the public URL never 404s. Both of these
  -- make it show "details not available" instead.
  --   is_active  the admin took it offline
  --   is_locked  the plan was downgraded past its card allowance
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  is_locked       TINYINT(1) NOT NULL DEFAULT 0
                  COMMENT 'Locked by a downgrade; admin chooses which to lock and release',

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_digital_cards_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,

  INDEX idx_cards_company (company_id),
  INDEX idx_cards_active  (company_id, is_active, is_locked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS card_scans (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  card_id      INT NOT NULL,

  -- Hash of IP + user agent, never the raw values: the count does not
  -- need to identify anyone, and storing visitor IPs against a named
  -- person would be personal data we have no reason to hold.
  viewer_hash  CHAR(64) NOT NULL,
  scan_date    DATE NOT NULL,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_card_scans_card
    FOREIGN KEY (card_id) REFERENCES digital_cards(id) ON DELETE CASCADE,

  -- One row per viewer per day. Without this the count is page loads,
  -- which bots, link previews and the owner checking their own card all
  -- inflate until nobody trusts the number.
  UNIQUE KEY uniq_scan_per_day (card_id, viewer_hash, scan_date),
  INDEX idx_scans_card (card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS card_leads (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  card_id       INT NOT NULL,
  -- Denormalised so leads survive and stay exportable even if the card
  -- row is ever removed, and so company-wide queries avoid a join.
  company_id    INT NOT NULL,

  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  email         VARCHAR(190) NULL,
  company_name  VARCHAR(160) NULL,
  message       TEXT NULL COMMENT 'Their enquiry or reason for getting in touch',

  notified_at   TIMESTAMP NULL COMMENT 'When the card owner was emailed; NULL if not yet sent',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_card_leads_card
    FOREIGN KEY (card_id) REFERENCES digital_cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_card_leads_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,

  INDEX idx_leads_company (company_id, created_at),
  INDEX idx_leads_card (card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
