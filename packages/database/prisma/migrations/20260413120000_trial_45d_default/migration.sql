-- Switch the default plan from 'free' to 'trial' for new tenants.
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'trial';

-- Backfill: existing tenants without an expiration get a 45-day trial starting
-- now, so they get the same window as new signups to subscribe before the
-- read-only / deactivation logic kicks in. Tenants with membershipExpiresAt
-- already set are left alone (those were manually granted or already on a
-- paid plan).
UPDATE "tenants"
SET
  "plan" = 'trial',
  "membershipExpiresAt" = NOW() + INTERVAL '45 days'
WHERE
  "membershipExpiresAt" IS NULL
  AND "isActive" = true;
