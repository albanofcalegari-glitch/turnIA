-- =============================================================================
-- Manual constraints — things Prisma cannot generate from schema.prisma
--
-- 1. Partial unique index for concurrent booking protection
-- 2. CHECK constraints for data integrity
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PARTIAL UNIQUE INDEX — double-booking protection (Layer 2)
--
-- Only one ACTIVE appointment (PENDING or CONFIRMED) per
-- (tenant, professional, exact start time).
-- Cancelled / completed appointments free the slot for re-booking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "uq_appointment_active_slot"
  ON "appointments" ("tenantId", "professionalId", "startAt")
  WHERE status IN ('PENDING', 'CONFIRMED');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CHECK CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Appointment: end must be after start
ALTER TABLE "appointments"
  ADD CONSTRAINT "chk_appointment_end_after_start"
  CHECK ("endAt" > "startAt");

-- Appointment: must have either a registered client OR guest name + email
ALTER TABLE "appointments"
  ADD CONSTRAINT "chk_appointment_client_or_guest"
  CHECK (
    "clientId" IS NOT NULL
    OR ("guestName" IS NOT NULL AND "guestEmail" IS NOT NULL)
  );

-- WorkSchedule: end time must be after start time (lexicographic on "HH:MM")
ALTER TABLE "work_schedules"
  ADD CONSTRAINT "chk_work_schedule_times"
  CHECK ("endTime" > "startTime");

-- ScheduleException: if both times provided, end must be after start
ALTER TABLE "schedule_exceptions"
  ADD CONSTRAINT "chk_schedule_exception_times"
  CHECK (
    "endTime" IS NULL
    OR "startTime" IS NULL
    OR "endTime" > "startTime"
  );
