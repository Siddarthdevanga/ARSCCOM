-- ============================================================
-- KEEP A DELETED CARD'S CONTACTS
-- ============================================================
-- Purpose: when an admin deletes a digital card, the people who shared
-- their details through it (card_leads, shown as "Contacts") stay with
-- the company instead of being deleted with the card. They are shown as
-- from a deleted card, under the owner's name as it was.
--
--   card_id          NULL once the card is deleted (was ON DELETE CASCADE)
--   card_owner_name  the card's name, written just before it is deleted
--
-- Run after add-digital-card-archive.sql. Until this is run, deleting a
-- filled-in card answers "not available yet" and deletes nothing.
--
-- Date: 2026-09-30
-- ============================================================

ALTER TABLE card_leads DROP FOREIGN KEY fk_card_leads_card;

ALTER TABLE card_leads
  MODIFY card_id INT NULL,
  ADD COLUMN card_owner_name VARCHAR(120) NULL
      COMMENT 'Owner of the card, kept when the card is deleted' AFTER card_id;

ALTER TABLE card_leads
  ADD CONSTRAINT fk_card_leads_card
      FOREIGN KEY (card_id) REFERENCES digital_cards(id) ON DELETE SET NULL;

-- ============================================================
-- VERIFY
-- ============================================================
-- SHOW CREATE TABLE card_leads;   -- fk_card_leads_card ... ON DELETE SET NULL

-- ============================================================
-- ROLLBACK (only while no deleted-card contacts exist)
-- ============================================================
-- ALTER TABLE card_leads DROP FOREIGN KEY fk_card_leads_card;
-- DELETE FROM card_leads WHERE card_id IS NULL;
-- ALTER TABLE card_leads MODIFY card_id INT NOT NULL, DROP COLUMN card_owner_name;
-- ALTER TABLE card_leads ADD CONSTRAINT fk_card_leads_card
--   FOREIGN KEY (card_id) REFERENCES digital_cards(id) ON DELETE CASCADE;
