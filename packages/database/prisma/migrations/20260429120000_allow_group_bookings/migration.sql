-- Drop the unique partial index that prevents group bookings.
-- The overlap / capacity check is now handled at application level
-- (appointments.service.ts) inside a SERIALIZABLE transaction, so
-- this DB-level guard is no longer needed and blocks multi-cupo services.
DROP INDEX IF EXISTS "uq_appointment_active_slot";
