-- ─────────────────────────────────────────────────────────────────────────────
-- Stage 1 (branches) — Phase 2
--
-- Phase 1 added the branches infrastructure as nullable and backfilled the
-- branchId on every existing row. Phase 2 now:
--
--   1. Marks branchId NOT NULL on work_schedules, appointments, resources.
--   2. Adds the missing FK constraints to "branches"(id).
--   3. Adds the secondary indexes that Prisma expects.
--   4. Drops the old work_schedules tenant-scoped unique and recreates it
--      branch-scoped, so the same professional can have different hours
--      in different sucursales.
--
-- Phase 2 will FAIL LOUDLY if any row in those three tables still has a
-- NULL branchId. That is intentional: we want a hard error before the
-- application starts assuming the column is non-null.
--
-- Pre-flight: phase 1 (20260407120000_add_branches_phase1) MUST already
-- be applied. That migration is the one that:
--   - creates the branches / professional_branches / service_branches tables
--   - creates a default branch row for every existing tenant
--   - backfills work_schedules.branchId / appointments.branchId / resources.branchId
--   - backfills professional_branches for every existing professional
-- Without that backfill the SET NOT NULL statements below will reject any
-- row with NULL branchId and the migration will roll back.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Mark branchId NOT NULL.
ALTER TABLE "work_schedules" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "appointments"   ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "resources"      ALTER COLUMN "branchId" SET NOT NULL;

-- 2. Foreign keys to branches.id. ON DELETE RESTRICT because a branch with
--    appointments/work_schedules/resources should be soft-deleted at the
--    application layer, not silently nuked.
ALTER TABLE "work_schedules"
  ADD CONSTRAINT "work_schedules_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Secondary indexes (matches the @@index() declarations in schema.prisma).
CREATE INDEX "work_schedules_branchId_idx"
  ON "work_schedules"("branchId");

CREATE INDEX "appointments_branchId_startAt_idx"
  ON "appointments"("branchId", "startAt");

CREATE INDEX "resources_branchId_idx"
  ON "resources"("branchId");

-- 4. WorkSchedule unique key: drop the tenant-scoped one and recreate
--    branch-scoped. The same professional may now have a Monday 09-13 row
--    on Sucursal A and a Monday 14-18 row on Sucursal B without colliding.
-- NOTE: the init migration created this as a UNIQUE INDEX (via CREATE UNIQUE
-- INDEX), not as a UNIQUE CONSTRAINT. In Postgres those are different beasts,
-- and DROP CONSTRAINT only works on the latter — so we DROP INDEX instead.
DROP INDEX IF EXISTS "work_schedules_tenantId_professionalId_dayOfWeek_key";

CREATE UNIQUE INDEX "work_schedules_branchId_professionalId_dayOfWeek_key"
  ON "work_schedules"("branchId", "professionalId", "dayOfWeek");
