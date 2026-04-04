# ============================================================================
# TurnIA — Guia de prueba local E2E (PowerShell)
#
# Copiar y pegar cada bloque en PowerShell.
# Despues de cada paso, guardar los IDs que se indican.
#
# Prerequisitos:
#   [x] PostgreSQL corriendo en localhost:5432
#   [x] DB "turnia" creada
#   [x] Node >= 20, pnpm >= 9
#   [x] .env configurado (copiar de .env.example)
#   [x] pnpm install; pnpm db:generate; pnpm db:migrate
#   [x] API corriendo en :4000  (cd apps/api; pnpm dev)
#   [x] Web corriendo en :3000  (cd apps/web; pnpm dev)  [opcional]
# ============================================================================

$API = "http://localhost:4000/api/v1"

# ============================================================================
# 0. HEALTH CHECK
#    Esperado: cualquier respuesta (404 esta OK, significa que el server anda)
# ============================================================================

try { Invoke-RestMethod "$API/" -ErrorAction Stop } catch {
    Write-Host "API responde en $API" -ForegroundColor Green
}

# ============================================================================
# 1. REGISTRAR TENANT + ADMIN
#    Esperado: 201 — devuelve tenant.id y adminUserId
#    Guardar: $TENANT_ID
# ============================================================================

$body = @{
    name           = "Barberia E2E"
    slug           = "barberia-e2e"
    type           = "barberia"
    adminEmail     = "admin@test.com"
    adminPassword  = "Test123456"
    adminFirstName = "Admin"
    adminLastName  = "E2E"
} | ConvertTo-Json

$r = Invoke-RestMethod "$API/tenants/register" -Method POST -ContentType "application/json" -Body $body
$r | ConvertTo-Json -Depth 5

$TENANT_ID = $r.tenant.id
Write-Host "TENANT_ID = $TENANT_ID" -ForegroundColor Yellow

# ============================================================================
# 2. LOGIN
#    Esperado: 200 — devuelve accessToken
#    Guardar: $TOKEN
# ============================================================================

$body = @{ email = "admin@test.com"; password = "Test123456" } | ConvertTo-Json

$r = Invoke-RestMethod "$API/auth/login" -Method POST -ContentType "application/json" -Body $body
$r | ConvertTo-Json -Depth 3

$TOKEN = $r.accessToken
Write-Host "TOKEN = $($TOKEN.Substring(0,20))..." -ForegroundColor Yellow

# ── Headers comunes (usar en todos los pasos siguientes) ───────────────────

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "X-Tenant-ID"   = $TENANT_ID
}

# ============================================================================
# 3. CREAR SERVICIO
#    Esperado: 201
#    Guardar: $SERVICE_ID
# ============================================================================

$body = @{
    name            = "Corte clasico"
    durationMinutes = 30
    price           = 5000
    bufferBefore    = 0
    bufferAfter     = 5
} | ConvertTo-Json

$r = Invoke-RestMethod "$API/services" -Method POST -ContentType "application/json" -Headers $headers -Body $body
$r | ConvertTo-Json -Depth 3

$SERVICE_ID = $r.id
Write-Host "SERVICE_ID = $SERVICE_ID" -ForegroundColor Yellow

# ============================================================================
# 4. CREAR PROFESIONAL (se vincula al admin automaticamente)
#    Esperado: 201
#    Guardar: $PRO_ID
# ============================================================================

$body = @{ displayName = "Barbero E2E"; color = "#E91E63" } | ConvertTo-Json

$r = Invoke-RestMethod "$API/professionals" -Method POST -ContentType "application/json" -Headers $headers -Body $body
$r | ConvertTo-Json -Depth 3

$PRO_ID = $r.id
Write-Host "PRO_ID = $PRO_ID" -ForegroundColor Yellow

# ============================================================================
# 5. VINCULAR SERVICIO AL PROFESIONAL
#    Esperado: 201
# ============================================================================

$body = @{ serviceId = $SERVICE_ID } | ConvertTo-Json

$r = Invoke-RestMethod "$API/professionals/$PRO_ID/services" -Method POST -ContentType "application/json" -Headers $headers -Body $body
$r | ConvertTo-Json -Depth 3

# ============================================================================
# 6. CREAR WORK SCHEDULE (Lunes a Viernes, 09:00 - 18:00)
#    Esperado: 201 x5
# ============================================================================

foreach ($day in 1..5) {
    $body = @{ dayOfWeek = $day; startTime = "09:00"; endTime = "18:00" } | ConvertTo-Json

    $r = Invoke-RestMethod "$API/schedules/$PRO_ID/work-schedule" -Method POST -ContentType "application/json" -Headers $headers -Body $body
    $dayName = @("", "Lun", "Mar", "Mie", "Jue", "Vie")[$day]
    Write-Host "  OK  WorkSchedule $dayName" -ForegroundColor Green
}

# ============================================================================
# 7. CONSULTAR SLOTS DISPONIBLES
#    Usar una fecha que caiga lunes-viernes.
#    Esperado: 200 — slots[] con horarios libres cada 15 min
#    Guardar: $FIRST_SLOT (startAt del primer slot)
# ============================================================================

# Calcular proximo lunes
$today = Get-Date
$daysUntilMonday = (8 - [int]$today.DayOfWeek) % 7
if ($daysUntilMonday -eq 0) { $daysUntilMonday = 7 }
$nextMonday = $today.AddDays($daysUntilMonday).ToString("yyyy-MM-dd")
Write-Host "Fecha de prueba: $nextMonday" -ForegroundColor Yellow

$r = Invoke-RestMethod "$API/schedules/$PRO_ID/slots?date=$nextMonday&serviceIds=$SERVICE_ID" -Headers @{ "X-Tenant-ID" = $TENANT_ID }
Write-Host "Slots encontrados: $($r.slots.Count)" -ForegroundColor Yellow

$FIRST_SLOT = $r.slots[0].startAt
Write-Host "Primer slot: $FIRST_SLOT" -ForegroundColor Yellow

# ============================================================================
# 8. BOOKING COMO GUEST (sin autenticacion)
#    Esperado: 201 — status = CONFIRMED (autoConfirm default)
#    Guardar: $APPT_GUEST
# ============================================================================

$body = @{
    professionalId = $PRO_ID
    startAt        = $FIRST_SLOT
    items          = @(@{ serviceId = $SERVICE_ID })
    guestName      = "Juan Perez"
    guestEmail     = "juan@test.com"
    guestPhone     = "+5491155551234"
} | ConvertTo-Json -Depth 3

$r = Invoke-RestMethod "$API/appointments" -Method POST -ContentType "application/json" -Headers @{ "X-Tenant-ID" = $TENANT_ID } -Body $body
$r | ConvertTo-Json -Depth 5

$APPT_GUEST = $r.id
Write-Host "APPT_GUEST = $APPT_GUEST | status = $($r.status)" -ForegroundColor Yellow

# ============================================================================
# 9. BOOKING AUTENTICADO (con JWT, slot diferente)
#    Esperado: 201 — clientId presente (se auto-crea Client)
#    Guardar: $APPT_AUTH
# ============================================================================

# Tomar un slot distinto (el 10mo slot para evitar overlap)
$AUTH_SLOT = $r2_slots = Invoke-RestMethod "$API/schedules/$PRO_ID/slots?date=$nextMonday&serviceIds=$SERVICE_ID" -Headers @{ "X-Tenant-ID" = $TENANT_ID }
$AUTH_SLOT = $r2_slots.slots[10].startAt
Write-Host "Slot autenticado: $AUTH_SLOT" -ForegroundColor Yellow

$body = @{
    professionalId = $PRO_ID
    startAt        = $AUTH_SLOT
    items          = @(@{ serviceId = $SERVICE_ID })
} | ConvertTo-Json -Depth 3

$r = Invoke-RestMethod "$API/appointments" -Method POST -ContentType "application/json" -Headers $headers -Body $body
$r | ConvertTo-Json -Depth 5

$APPT_AUTH = $r.id
Write-Host "APPT_AUTH = $APPT_AUTH | clientId = $($r.clientId)" -ForegroundColor Yellow

# ============================================================================
# 10. CONFLICTO 409 (repetir el mismo slot del guest)
#     Esperado: 409 Conflict — "That slot is no longer available"
# ============================================================================

$body = @{
    professionalId = $PRO_ID
    startAt        = $FIRST_SLOT
    items          = @(@{ serviceId = $SERVICE_ID })
    guestName      = "Otro Guest"
    guestEmail     = "otro@test.com"
} | ConvertTo-Json -Depth 3

try {
    Invoke-RestMethod "$API/appointments" -Method POST -ContentType "application/json" -Headers @{ "X-Tenant-ID" = $TENANT_ID } -Body $body
    Write-Host "  FAIL  Deberia haber dado 409" -ForegroundColor Red
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 409) {
        Write-Host "  OK  [409] Conflicto detectado correctamente" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  Esperado 409, recibido $status" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

# ============================================================================
# 11. AGENDA — LISTAR TURNOS DEL DIA
#     Esperado: 200 — array con 2 appointments
# ============================================================================

$r = Invoke-RestMethod "$API/appointments?date=$nextMonday" -Headers $headers
Write-Host "Turnos en agenda: $($r.Count) (esperado: 2)" -ForegroundColor Yellow
$r | ForEach-Object { Write-Host "  $($_.id) | $($_.status) | $($_.startAt)" }

# ============================================================================
# 12a. COMPLETAR TURNO GUEST
#      Esperado: 200 — status = COMPLETED
# ============================================================================

$r = Invoke-RestMethod "$API/appointments/$APPT_GUEST/complete" -Method PATCH -Headers $headers
Write-Host "  OK  Complete: status = $($r.status)" -ForegroundColor Green

# ============================================================================
# 12b. CANCELAR TURNO AUTENTICADO
#      Esperado: 200 — status = CANCELLED
# ============================================================================

$body = @{ reason = "Test E2E cancelacion" } | ConvertTo-Json

$r = Invoke-RestMethod "$API/appointments/$APPT_AUTH/cancel" -Method PATCH -ContentType "application/json" -Headers $headers -Body $body
Write-Host "  OK  Cancel: status = $($r.status)" -ForegroundColor Green

# ============================================================================
# 13. SLOTS POST-CANCELACION (el slot cancelado vuelve a estar libre)
#     Esperado: 200 — mas slots que antes
# ============================================================================

$r = Invoke-RestMethod "$API/schedules/$PRO_ID/slots?date=$nextMonday&serviceIds=$SERVICE_ID" -Headers @{ "X-Tenant-ID" = $TENANT_ID }
Write-Host "Slots post-cancel: $($r.slots.Count)" -ForegroundColor Yellow

# ============================================================================
# RESUMEN
# ============================================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " RESUMEN DE IDs" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TENANT_ID  = $TENANT_ID"
Write-Host "  SERVICE_ID = $SERVICE_ID"
Write-Host "  PRO_ID     = $PRO_ID"
Write-Host "  APPT_GUEST = $APPT_GUEST"
Write-Host "  APPT_AUTH  = $APPT_AUTH"
Write-Host ""
Write-Host "--- Prueba visual (frontend) ---" -ForegroundColor Cyan
Write-Host "  Booking publico: http://localhost:3000/barberia-e2e"
Write-Host "  Login admin:     http://localhost:3000/login"
Write-Host "    Email: admin@test.com"
Write-Host "    Pass:  Test123456"
Write-Host ""
Write-Host "--- Diagnostico rapido ---" -ForegroundColor Cyan
Write-Host "  ECONNREFUSED :5432      -> PostgreSQL no levanto"
Write-Host "  P1001 Can't reach db    -> DATABASE_URL mal o DB no existe"
Write-Host "  P2002 Unique constraint -> Slug o email duplicado, cambiar valores"
Write-Host "  401 Unauthorized        -> Token expirado o faltante"
Write-Host "  403 Forbidden           -> Falta X-Tenant-ID o sin rol ADMIN"
Write-Host "  404 Not found           -> ID incorrecto o recurso inactivo"
Write-Host "  400 Validation          -> Campo requerido faltante"
Write-Host "  Slots vacios            -> WorkSchedule no creado para ese dia"
