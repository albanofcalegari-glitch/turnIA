-- ============================================================
-- SCRIPT: Insertar turnos de prueba para tenant "aura-natural"
-- DB: PostgreSQL (turnia_dev)
-- Ejecutar con: psql -U postgres -d turnia_dev -f scripts/seed-aura-natural-appointments.sql
-- ============================================================
-- SEGURIDAD:
--   - Todo dentro de transacción
--   - Verifica existencia de tenant, branch, profesionales, servicios y vínculos
--   - No hardcodea IDs
--   - Evita duplicados por profesional+horario
--   - Por defecto termina con ROLLBACK (prueba segura)
--   - Para aplicar: cambiar ROLLBACK por COMMIT en la ÚLTIMA LÍNEA
-- ============================================================

BEGIN;

-- ============================================================
-- 1. VERIFICAR TENANT
-- ============================================================
DO $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'aura-natural' AND "isActive" = true;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ABORTANDO: No se encontró tenant activo con slug "aura-natural"';
  END IF;
  RAISE NOTICE 'Tenant encontrado: id=%', v_tenant_id;
END $$;

-- ============================================================
-- 2. INSERTAR CLIENTES DE PRUEBA (si no existen)
-- ============================================================
DO $$
DECLARE
  v_tenant_id TEXT;
  v_client_names TEXT[][] := ARRAY[
    ARRAY['Juan', 'Pérez'],
    ARRAY['María', 'Gómez'],
    ARRAY['Lucía', 'Fernández'],
    ARRAY['Carlos', 'Rodríguez'],
    ARRAY['Sofía', 'Martínez'],
    ARRAY['Diego', 'López'],
    ARRAY['Camila', 'Torres'],
    ARRAY['Matías', 'Herrera'],
    ARRAY['Valentina', 'Ruiz'],
    ARRAY['Nicolás', 'Romero']
  ];
  v_first TEXT;
  v_last TEXT;
  v_email TEXT;
  i INT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'aura-natural';

  FOR i IN 1..array_length(v_client_names, 1) LOOP
    v_first := v_client_names[i][1];
    v_last := v_client_names[i][2];
    v_email := lower(replace(v_first, ' ', '')) || '.' || lower(replace(v_last, ' ', '')) || '.test@turnit.local';

    IF NOT EXISTS (
      SELECT 1 FROM clients
      WHERE "tenantId" = v_tenant_id AND email = v_email
    ) THEN
      INSERT INTO clients (id, "tenantId", "firstName", "lastName", email, phone, "isActive", "createdAt", "updatedAt")
      VALUES (
        'seed_client_' || i || '_' || substr(md5(random()::text), 1, 8),
        v_tenant_id,
        v_first,
        v_last,
        v_email,
        '+5411' || lpad((floor(random() * 90000000 + 10000000))::text, 8, '0'),
        true,
        now(),
        now()
      );
      RAISE NOTICE 'Cliente creado: % %', v_first, v_last;
    ELSE
      RAISE NOTICE 'Cliente ya existe: % %', v_first, v_last;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. GENERAR 40 TURNOS DE PRUEBA
-- ============================================================
DO $$
DECLARE
  v_tenant_id TEXT;
  v_branch_id TEXT;
  v_prof RECORD;
  v_svc RECORD;
  v_client RECORD;
  v_appt_id TEXT;
  v_item_id TEXT;
  v_start TIMESTAMP;
  v_end TIMESTAMP;
  v_date DATE;
  v_hour INT;
  v_minute INT;
  v_status TEXT;
  v_statuses TEXT[] := ARRAY['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  v_price NUMERIC;
  v_duration INT;
  v_count INT := 0;
  v_target INT := 40;
  v_attempts INT := 0;
  v_max_attempts INT := 300;
  v_day_offset INT;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'aura-natural';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant aura-natural no encontrado';
  END IF;

  -- Obtener branch default
  SELECT id INTO v_branch_id
  FROM branches
  WHERE "tenantId" = v_tenant_id AND "isDefault" = true AND "isActive" = true;

  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id
    FROM branches
    WHERE "tenantId" = v_tenant_id AND "isActive" = true
    ORDER BY "createdAt" ASC
    LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró branch activa para tenant aura-natural';
  END IF;

  RAISE NOTICE 'Branch: %', v_branch_id;

  -- Verificar profesionales con servicios
  IF NOT EXISTS (
    SELECT 1
    FROM professionals p
    JOIN professional_services ps ON ps."professionalId" = p.id
    JOIN services s ON s.id = ps."serviceId"
    WHERE p."tenantId" = v_tenant_id AND p."isActive" = true AND s."isActive" = true
  ) THEN
    RAISE EXCEPTION 'No hay profesionales con servicios vinculados activos en el tenant';
  END IF;

  -- Verificar clientes
  IF NOT EXISTS (
    SELECT 1 FROM clients WHERE "tenantId" = v_tenant_id AND "isActive" = true
  ) THEN
    RAISE EXCEPTION 'No hay clientes activos en el tenant';
  END IF;

  WHILE v_count < v_target AND v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;

    -- Profesional random con servicios
    SELECT p.id AS prof_id, p."displayName" AS prof_name
    INTO v_prof
    FROM professionals p
    WHERE p."tenantId" = v_tenant_id
      AND p."isActive" = true
      AND EXISTS (
        SELECT 1 FROM professional_services ps
        JOIN services s ON s.id = ps."serviceId"
        WHERE ps."professionalId" = p.id AND s."isActive" = true AND s."tenantId" = v_tenant_id
      )
    ORDER BY random()
    LIMIT 1;

    -- Servicio random vinculado al profesional
    SELECT s.id AS svc_id, s.name AS svc_name, s."durationMinutes" AS svc_duration,
           COALESCE(ps."overridePrice", s.price) AS svc_price
    INTO v_svc
    FROM professional_services ps
    JOIN services s ON s.id = ps."serviceId"
    WHERE ps."professionalId" = v_prof.prof_id
      AND s."isActive" = true
      AND s."tenantId" = v_tenant_id
    ORDER BY random()
    LIMIT 1;

    -- Cliente random
    SELECT id AS client_id INTO v_client
    FROM clients
    WHERE "tenantId" = v_tenant_id AND "isActive" = true
    ORDER BY random()
    LIMIT 1;

    -- Fecha random (hoy + 0..29 días)
    v_day_offset := floor(random() * 30)::INT;
    v_date := CURRENT_DATE + v_day_offset;

    -- Hora random (09:00 a 17:30, slots de 30 min)
    v_hour := 9 + floor(random() * 9)::INT;
    v_minute := (floor(random() * 2) * 30)::INT;

    v_duration := v_svc.svc_duration;
    v_start := v_date + (v_hour || ':' || lpad(v_minute::text, 2, '0'))::TIME;
    v_end := v_start + (v_duration || ' minutes')::INTERVAL;

    -- No pasar de las 19:00
    IF v_end::TIME > '19:00'::TIME THEN
      CONTINUE;
    END IF;

    -- Verificar que no hay overlap para el mismo profesional
    IF EXISTS (
      SELECT 1 FROM appointments
      WHERE "professionalId" = v_prof.prof_id
        AND status NOT IN ('CANCELLED', 'RESCHEDULED')
        AND "startAt" < v_end
        AND "endAt" > v_start
    ) THEN
      CONTINUE;
    END IF;

    -- Estado random
    v_status := v_statuses[1 + floor(random() * array_length(v_statuses, 1))::INT];
    v_price := v_svc.svc_price;

    -- IDs únicos
    v_appt_id := 'seed_appt_' || v_count || '_' || substr(md5(random()::text), 1, 12);
    v_item_id := 'seed_item_' || v_count || '_' || substr(md5(random()::text), 1, 12);

    -- INSERT APPOINTMENT
    INSERT INTO appointments (
      id, "tenantId", "branchId", "clientId", "professionalId",
      status, "startAt", "endAt", "totalMinutes", "totalPrice", currency,
      "createdAt", "updatedAt", version
    ) VALUES (
      v_appt_id,
      v_tenant_id,
      v_branch_id,
      v_client.client_id,
      v_prof.prof_id,
      v_status::"AppointmentStatus",
      v_start,
      v_end,
      v_duration,
      v_price,
      'ARS',
      now(),
      now(),
      1
    );

    -- INSERT APPOINTMENT ITEM
    INSERT INTO appointment_items (
      id, "appointmentId", "serviceId", "serviceName", "durationMinutes", price, "order"
    ) VALUES (
      v_item_id,
      v_appt_id,
      v_svc.svc_id,
      v_svc.svc_name,
      v_duration,
      v_price,
      0
    );

    -- Setear campos según estado
    IF v_status = 'CONFIRMED' THEN
      UPDATE appointments SET "confirmedAt" = now() - interval '1 hour' WHERE id = v_appt_id;
    ELSIF v_status = 'COMPLETED' THEN
      UPDATE appointments
      SET "confirmedAt" = v_start - interval '2 hours',
          "completedAt" = v_end + interval '5 minutes'
      WHERE id = v_appt_id;
    ELSIF v_status = 'CANCELLED' THEN
      UPDATE appointments
      SET "cancelledAt" = v_start - interval '3 hours',
          "cancellationReason" = 'Cancelado por cliente (seed de prueba)'
      WHERE id = v_appt_id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Turnos insertados: % de % objetivo en % intentos', v_count, v_target, v_attempts;
  RAISE NOTICE '========================================';

  IF v_count < v_target THEN
    RAISE WARNING 'No se pudieron generar todos los turnos (posibles colisiones de horario).';
  END IF;
END $$;

-- ============================================================
-- 4. RESUMEN
-- ============================================================
SELECT
  a.id,
  p."displayName" AS profesional,
  ai."serviceName" AS servicio,
  c."firstName" || ' ' || c."lastName" AS cliente,
  a.status,
  a."startAt"::DATE AS fecha,
  to_char(a."startAt", 'HH24:MI') AS hora_inicio,
  to_char(a."endAt", 'HH24:MI') AS hora_fin,
  a."totalPrice" AS precio
FROM appointments a
JOIN professionals p ON p.id = a."professionalId"
LEFT JOIN clients c ON c.id = a."clientId"
LEFT JOIN appointment_items ai ON ai."appointmentId" = a.id
WHERE a."tenantId" = (SELECT id FROM tenants WHERE slug = 'aura-natural')
  AND a.id LIKE 'seed_appt_%'
ORDER BY a."startAt", p."displayName";

-- ============================================================
-- 5. CONTEO POR ESTADO
-- ============================================================
SELECT
  status,
  count(*) AS cantidad
FROM appointments
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'aura-natural')
  AND id LIKE 'seed_appt_%'
GROUP BY status
ORDER BY status;

-- ============================================================
-- >>> CAMBIAR ROLLBACK POR COMMIT CUANDO ESTÉ VALIDADO <<<
-- ============================================================
ROLLBACK;
