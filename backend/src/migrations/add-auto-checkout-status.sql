-- Migration: Add 'auto_checked_out' to visit_status ENUM on visitors table
-- Visitors who are still IN at end of day (11:59 PM) get auto-checked out on next admin login.

ALTER TABLE visitors
MODIFY COLUMN visit_status ENUM(
  'pending',
  'accepted',
  'declined',
  'checked_out',
  'auto_checked_out'
) DEFAULT 'pending';

-- Verify: SHOW COLUMNS FROM visitors LIKE 'visit_status';
