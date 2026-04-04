-- Migration: client_integration
-- Moves Appointment.clientId FK from users → clients.
--
-- Strategy (preserves all existing booking history):
--   1. Create Client records for every unique (tenant, user) pair that already
--      has at least one appointment.
--   2. Rewrite appointment.clientId from the user's ID to the new client's ID.
--   3. Null out any clientId that could not be migrated (user was deleted).
--   4. Drop the old FK (appointments → users) and add the new one (→ clients).

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Upsert Client rows from existing appointment→user pairs
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: client_integration

INSERT INTO "clients" (
    "id",
    "tenantId",
    "userId",
    "firstName",
    "lastName",
    "email",
    "phone",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    appt."tenantId",
    u."id",
    u."firstName",
    u."lastName",
    u."email",
    u."phone",
    TRUE,
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT "tenantId", "clientId"
    FROM "appointments"
    WHERE "clientId" IS NOT NULL
) appt
JOIN "users" u ON u."id" = appt."clientId"
ON CONFLICT ("tenantId", "userId") DO NOTHING;

UPDATE "appointments" a
SET "clientId" = c."id"
FROM "clients" c
WHERE c."userId" = a."clientId"
  AND c."tenantId" = a."tenantId"
  AND a."clientId" IS NOT NULL;

UPDATE "appointments"
SET "clientId" = NULL
WHERE "clientId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "clients" WHERE "id" = "appointments"."clientId"
  );

ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_clientId_fkey";

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_clientId_fkey"
    FOREIGN KEY ("clientId")
    REFERENCES "clients"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;