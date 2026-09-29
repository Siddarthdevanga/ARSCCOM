-- Digital cards: optional photo on the printed card.
-- Off by default; the photo is always shown on the web card either way.
-- Run BEFORE deploying the backend that writes this column.
ALTER TABLE digital_cards
  ADD COLUMN photo_on_print TINYINT(1) NOT NULL DEFAULT 0 AFTER photo_url;
