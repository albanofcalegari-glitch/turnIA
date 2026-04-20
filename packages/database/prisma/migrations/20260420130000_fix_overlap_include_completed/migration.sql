-- Fix: include COMPLETED in the partial unique index so that slots marked as
-- completed before their actual time still block new bookings.

DROP INDEX IF EXISTS "uq_appointment_active_slot";

CREATE UNIQUE INDEX "uq_appointment_active_slot"
  ON "appointments" ("tenantId", "professionalId", "startAt")
  WHERE status IN ('PENDING', 'CONFIRMED', 'COMPLETED');
