-- ============================================================
-- KEEP A QR CARD BATCH'S COLOURS ON THE BATCH
-- ============================================================
-- Purpose: a batch is printed in the colours the superadmin picked, but
-- until now those colours lived only on each card, and a claim (the owner
-- picks their own colours) or a reset (back to the default) overwrote them.
-- A reprint then came out in mixed colours, and a reset card's claim form
-- no longer matched the card in the holder's hand.
--
--   theme / bg_color / text_color / accent_color
--     the batch's colours, as on digital_cards. The print sheet always
--     uses these; a reset card goes back to them.
--
-- Until this is run, new batches still work: their cards carry the
-- colours as before, and print and reset fall back to the card's own.
--
-- Date: 2026-10-01
-- ============================================================

ALTER TABLE card_batches
  ADD COLUMN theme        VARCHAR(32) NOT NULL DEFAULT 'ink' AFTER header,
  ADD COLUMN bg_color     VARCHAR(9)  NULL AFTER theme,
  ADD COLUMN text_color   VARCHAR(9)  NULL AFTER bg_color,
  ADD COLUMN accent_color VARCHAR(9)  NULL AFTER text_color;

-- Existing batches: take the colours of the batch's first card nobody has
-- claimed yet, which still has the colours it was printed in. A batch with
-- every card claimed keeps the default, which is what all batches printed
-- before batch colours existed used.
UPDATE card_batches b
   SET theme = COALESCE((SELECT c.theme FROM digital_cards c
                          WHERE c.batch_id = b.id AND c.source = 'pool' AND c.claimed_at IS NULL
                          ORDER BY c.serial_no LIMIT 1), 'ink'),
       bg_color = (SELECT c.bg_color FROM digital_cards c
                    WHERE c.batch_id = b.id AND c.source = 'pool' AND c.claimed_at IS NULL
                    ORDER BY c.serial_no LIMIT 1),
       text_color = (SELECT c.text_color FROM digital_cards c
                      WHERE c.batch_id = b.id AND c.source = 'pool' AND c.claimed_at IS NULL
                      ORDER BY c.serial_no LIMIT 1),
       accent_color = (SELECT c.accent_color FROM digital_cards c
                        WHERE c.batch_id = b.id AND c.source = 'pool' AND c.claimed_at IS NULL
                        ORDER BY c.serial_no LIMIT 1);

-- ============================================================
-- VERIFY
-- ============================================================
-- SELECT id, name, theme, bg_color, text_color, accent_color FROM card_batches;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE card_batches
--   DROP COLUMN accent_color, DROP COLUMN text_color, DROP COLUMN bg_color, DROP COLUMN theme;
