-- ─────────────────────────────────────────────────────────────────────────────
-- Stage 1 (branches) — Phase 1
--
-- Adds the branches infrastructure WITHOUT enforcing NOT NULL on the new
-- branchId columns. Phase 1 is non-breaking: existing code that ignores the
-- new column keeps working, and the backfill at the bottom guarantees that
-- by the end of this migration every existing row has a branchId pointing
-- to the tenant's default branch.
--
-- Phase 2 (next migration) flips the columns to NOT NULL and adds the FKs
-- once we are confident no row was missed.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tenant flag — drives whether the UI exposes branch selection.
ALTER TABLE "tenants"
  ADD COLUMN "hasMultipleBranches" BOOLEAN NOT NULL DEFAULT false;

-- 2. branches table
CREATE TABLE "branches" (
    "id"        TEXT         NOT NULL,
    "tenantId"  TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "slug"      TEXT         NOT NULL,
    "address"   TEXT,
    "phone"     TEXT,
    "timezone"  TEXT,
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "isDefault" BOOLEAN      NOT NULL DEFAULT false,
    "order"     INTEGER      NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branches_tenantId_slug_key"
  ON "branches"("tenantId", "slug");

CREATE INDEX "branches_tenantId_isActive_idx"
  ON "branches"("tenantId", "isActive");

ALTER TABLE "branches"
  ADD CONSTRAINT "branches_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. professional_branches join
CREATE TABLE "professional_branches" (
    "professionalId" TEXT         NOT NULL,
    "branchId"       TEXT         NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_branches_pkey" PRIMARY KEY ("professionalId","branchId")
);

CREATE INDEX "professional_branches_branchId_idx"
  ON "professional_branches"("branchId");

ALTER TABLE "professional_branches"
  ADD CONSTRAINT "professional_branches_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "professionals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_branches"
  ADD CONSTRAINT "professional_branches_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. service_branches join (opt-in: empty ⇒ available everywhere)
CREATE TABLE "service_branches" (
    "serviceId" TEXT NOT NULL,
    "branchId"  TEXT NOT NULL,

    CONSTRAINT "service_branches_pkey" PRIMARY KEY ("serviceId","branchId")
);

CREATE INDEX "service_branches_branchId_idx"
  ON "service_branches"("branchId");

ALTER TABLE "service_branches"
  ADD CONSTRAINT "service_branches_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_branches"
  ADD CONSTRAINT "service_branches_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add nullable branchId columns. NOT NULL + FK happen in phase 2
--    so the backfill below has room to populate them safely.
ALTER TABLE "work_schedules" ADD COLUMN "branchId" TEXT;
ALTER TABLE "appointments"   ADD COLUMN "branchId" TEXT;
ALTER TABLE "resources"      ADD COLUMN "branchId" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL
-- ─────────────────────────────────────────────────────────────────────────────

-- 6. Create one default branch per existing tenant.
--    The id is a deterministic-looking 25-char string built from md5() so
--    that it is unique across tenants without needing pgcrypto/uuid-ossp.
INSERT INTO "branches" (
  "id",
  "tenantId",
  "name",
  "slug",
  "address",
  "phone",
  "isDefault",
  "isActive",
  "order",
  "createdAt",
  "updatedAt"
)
SELECT
  'br' || substr(md5(t."id" || clock_timestamp()::text), 1, 23),
  t."id",
  'Sucursal principal',
  'principal',
  t."address",
  t."phone",
  true,
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants" t;

-- 7. Backfill branchId on every existing row pointing to its tenant's
--    default branch. Phase 2 SET NOT NULL will fail loudly if any row
--    is missed here.
UPDATE "work_schedules" ws
SET "branchId" = b."id"
FROM "branches" b
WHERE b."tenantId" = ws."tenantId"
  AND b."isDefault" = true;

UPDATE "appointments" a
SET "branchId" = b."id"
FROM "branches" b
WHERE b."tenantId" = a."tenantId"
  AND b."isDefault" = true;

UPDATE "resources" r
SET "branchId" = b."id"
FROM "branches" b
WHERE b."tenantId" = r."tenantId"
  AND b."isDefault" = true;

-- 8. Backfill professional_branches: every existing professional belongs
--    to the default branch of its tenant.
INSERT INTO "professional_branches" ("professionalId", "branchId", "createdAt")
SELECT p."id", b."id", CURRENT_TIMESTAMP
FROM "professionals" p
JOIN "branches" b
  ON b."tenantId" = p."tenantId"
 AND b."isDefault" = true;
