# Database Migrations

This directory contains SQL migration files for the ARSCCOM application. Run these migrations in order when setting up or updating the database.

## Migration Order

### 1. Grace Period Feature

Run these migrations to add the grace period functionality:

#### a. `add-grace-period-enum.sql` (Run FIRST)
```bash
mysql -u root -p'Root@123' -D arsccom < backend/src/migrations/add-grace-period-enum.sql
```

**What it does:**
- Modifies the `subscription_status` ENUM column to include `grace_period` as a valid value
- Allowed values: `pending`, `trial`, `active`, `grace_period`, `expired`, `cancelled`

**Why needed:** Without this, trying to set a company's status to `grace_period` will fail with "Data truncated for column 'subscription_status'" error.

#### b. `add-grace-period.sql` (Run SECOND)
```bash
mysql -u root -p'Root@123' -D arsccom < backend/src/migrations/add-grace-period.sql
```

**What it does:**
- Adds `grace_period_ends_at` column (DATETIME) to track when grace period expires
- Adds `grace_period_day` column (INT) to track current day in grace period (0-10)
- Creates index on `grace_period_ends_at` for efficient cron job queries

### 2. Email OTP Feature

#### `add-visitor-otp-email.sql`
```bash
mysql -u root -p'Root@123' -D arsccom < backend/src/migrations/add-visitor-otp-email.sql
```

**What it does:**
- Adds `email` column to `visitor_otp` table
- Creates index on `(email, company_id)` for efficient OTP lookups

**Note:** If you see "Duplicate column name 'email'" error, the column already exists. Just add the index:
```sql
ALTER TABLE visitor_otp ADD INDEX idx_email_company (email, company_id);
```

## Verification

After running migrations, verify the changes:

```sql
-- Check subscription_status ENUM values
SHOW COLUMNS FROM companies LIKE 'subscription_status';

-- Check grace period columns
DESCRIBE companies;

-- Check visitor_otp email column
DESCRIBE visitor_otp;
```

## Rollback (If Needed)

If you need to rollback the grace period feature:

```sql
-- Remove grace period from ENUM
ALTER TABLE companies
MODIFY COLUMN subscription_status ENUM(
  'pending', 'trial', 'active', 'expired', 'cancelled'
) DEFAULT 'pending';

-- Remove grace period columns
ALTER TABLE companies
DROP COLUMN grace_period_ends_at,
DROP COLUMN grace_period_day;

-- Remove email from visitor_otp
ALTER TABLE visitor_otp DROP COLUMN email;
```

## Troubleshooting

### Error: "Data truncated for column 'subscription_status'"
**Solution:** Run `add-grace-period-enum.sql` first to add `grace_period` to the ENUM values.

### Error: "Duplicate column name 'email'"
**Solution:** The email column already exists in visitor_otp. Skip the ALTER TABLE ADD COLUMN and only add the index if needed.

### Error: "Access denied"
**Solution:** Ensure you're using the correct MySQL credentials and have necessary privileges.
