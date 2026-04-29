import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { AppointmentStatus, ExceptionType } from '@prisma/client'
import { TenantRole, JwtPayload } from '@turnia/shared'
import {
  TimeInterval,
  ServiceSnapshot,
  AvailableSlot,
  UnavailableSlot,
  SlotsResponse,
  UnavailableReason,
  DayAvailability,
  AvailableDaysResponse,
} from './slots.types'
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto'
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto'
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto'
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto'
import { BranchesService } from '../branches/branches.service'

/** Active appointment statuses that block calendar time */
const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
]

/** Exception types that block the entire day */
const FULL_DAY_BLOCK_TYPES: ExceptionType[] = [
  ExceptionType.VACATION,
  ExceptionType.HOLIDAY,
]

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // WorkSchedule — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkSchedule(professionalId: string, branchId?: string) {
    return this.prisma.workSchedule.findMany({
      where:   {
        professionalId,
        isActive: true,
        ...(branchId && { branchId }),
      },
      orderBy: [{ branchId: 'asc' }, { dayOfWeek: 'asc' }],
    })
  }

  /**
   * Creates a recurring work schedule entry for a professional.
   *
   * Rules:
   * - Only ADMIN or the professional themselves can create schedules.
   * - One entry per day of week per professional (service-level enforcement).
   *   Updating hours for a day already configured requires PATCH, not a new POST.
   * - startTime must be before endTime.
   */
  async createWorkSchedule(
    tenantId:       string,
    professionalId: string,
    caller:         JwtPayload,
    dto:            CreateWorkScheduleDto,
  ) {
    const professional = await this.requireProfessionalAccess(tenantId, professionalId, caller)

    this.validateTimeRange(dto.startTime, dto.endTime)

    // Resolve branch (validates ownership + single-branch fallback) and
    // verify the professional actually atende en esa sucursal.
    const branchId = await this.branches.resolveBranchId(tenantId, dto.branchId)
    await this.branches.requireProfessionalInBranch(branchId, professional.id)

    // Uniqueness is per (branchId, professionalId, dayOfWeek): the same pro
    // can have different hours on the same weekday at different sucursales.
    const existing = await this.prisma.workSchedule.findFirst({
      where: { professionalId: professional.id, branchId, dayOfWeek: dto.dayOfWeek },
    })
    if (existing) {
      throw new ConflictException(
        `Ya existe un horario laboral para el día ${dto.dayOfWeek} en esta sucursal (id: ${existing.id}). Usá PATCH para actualizarlo.`,
      )
    }

    return this.prisma.workSchedule.create({
      data: {
        tenantId:       tenantId,
        branchId,
        professionalId: professional.id,
        dayOfWeek:      dto.dayOfWeek,
        startTime:      dto.startTime,
        endTime:        dto.endTime,
        isActive:       dto.isActive ?? true,
      },
    })
  }

  /**
   * Updates times or active state of an existing work schedule entry.
   * Changing the day of week requires delete + create.
   */
  async updateWorkSchedule(
    tenantId:       string,
    professionalId: string,
    id:             string,
    caller:         JwtPayload,
    dto:            UpdateWorkScheduleDto,
  ) {
    await this.requireProfessionalAccess(tenantId, professionalId, caller)

    const entry = await this.prisma.workSchedule.findFirst({
      where: { id, professionalId },
    })
    if (!entry) throw new NotFoundException('Horario laboral no encontrado')

    // Resolve effective times for range validation
    const effectiveStart = dto.startTime ?? entry.startTime
    const effectiveEnd   = dto.endTime   ?? entry.endTime
    this.validateTimeRange(effectiveStart, effectiveEnd)

    return this.prisma.workSchedule.update({
      where: { id },
      data:  {
        ...(dto.startTime !== undefined && { startTime: dto.startTime }),
        ...(dto.endTime   !== undefined && { endTime:   dto.endTime   }),
        ...(dto.isActive  !== undefined && { isActive:  dto.isActive  }),
      },
    })
  }

  /**
   * Deletes a work schedule entry.
   * This does NOT cancel existing appointments — callers should verify impact first.
   */
  async deleteWorkSchedule(
    tenantId:       string,
    professionalId: string,
    id:             string,
    caller:         JwtPayload,
  ) {
    await this.requireProfessionalAccess(tenantId, professionalId, caller)

    const entry = await this.prisma.workSchedule.findFirst({
      where: { id, professionalId },
    })
    if (!entry) throw new NotFoundException('Horario laboral no encontrado')

    await this.prisma.workSchedule.delete({ where: { id } })
    return { deleted: true, id }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ScheduleException — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async getExceptions(professionalId: string, from: Date, to: Date) {
    return this.prisma.scheduleException.findMany({
      where: {
        professionalId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    })
  }

  /**
   * Creates a schedule exception (block, vacation, holiday, or custom hours).
   *
   * Rules:
   * - CUSTOM_HOURS requires both startTime and endTime.
   * - BLOCK with times = partial-day block; without = full-day block.
   * - VACATION and HOLIDAY are always full-day; times are ignored if provided.
   * - Multiple exceptions on the same date are allowed (e.g. two partial blocks).
   */
  async createException(
    tenantId:       string,
    professionalId: string,
    caller:         JwtPayload,
    dto:            CreateScheduleExceptionDto,
  ) {
    const professional = await this.requireProfessionalAccess(tenantId, professionalId, caller)

    this.validateExceptionTimes(dto.type, dto.startTime, dto.endTime)

    return this.prisma.scheduleException.create({
      data: {
        tenantId:       tenantId,
        professionalId: professional.id,
        date:           new Date(dto.date),
        type:           dto.type,
        startTime:      dto.startTime,
        endTime:        dto.endTime,
        reason:         dto.reason,
      },
    })
  }

  async updateException(
    tenantId:       string,
    professionalId: string,
    id:             string,
    caller:         JwtPayload,
    dto:            UpdateScheduleExceptionDto,
  ) {
    await this.requireProfessionalAccess(tenantId, professionalId, caller)

    const entry = await this.prisma.scheduleException.findFirst({
      where: { id, professionalId },
    })
    if (!entry) throw new NotFoundException('Excepción de horario no encontrada')

    const effectiveType  = dto.type      ?? entry.type
    const effectiveStart = dto.startTime ?? entry.startTime ?? undefined
    const effectiveEnd   = dto.endTime   ?? entry.endTime   ?? undefined
    this.validateExceptionTimes(effectiveType, effectiveStart, effectiveEnd)

    return this.prisma.scheduleException.update({
      where: { id },
      data:  {
        ...(dto.type      !== undefined && { type:      dto.type      }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime }),
        ...(dto.endTime   !== undefined && { endTime:   dto.endTime   }),
        ...(dto.reason    !== undefined && { reason:    dto.reason    }),
      },
    })
  }

  async deleteException(
    tenantId:       string,
    professionalId: string,
    id:             string,
    caller:         JwtPayload,
  ) {
    await this.requireProfessionalAccess(tenantId, professionalId, caller)

    const entry = await this.prisma.scheduleException.findFirst({
      where: { id, professionalId },
    })
    if (!entry) throw new NotFoundException('Excepción de horario no encontrada')

    await this.prisma.scheduleException.delete({ where: { id } })
    return { deleted: true, id }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core availability engine
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Computes all available booking slots for a professional on a given date
   * given one or more services to be performed in sequence.
   *
   * Algorithm:
   *   1. Validate professional and load tenant config (timezone, slot interval)
   *   2. Validate services and resolve overrides per professional
   *   3. Compute total booking duration = Σ(bufferBefore₀ + duration + bufferAfter)
   *   4. Find the work window for this day (WorkSchedule or CustomHours exception)
   *   5. Check for full-day blocking exceptions → return empty if found
   *   6. Collect busy intervals: existing appointments + partial-day blocks
   *   7. Walk the work window in slotInterval steps, emit slots that fit without overlap
   *
   * Future extensions:
   *   - Multi-professional: run this per professional and merge/intersect
   *   - Resource constraints: add resource busy intervals to step 6
   *   - Booking horizon: filter dates beyond scheduleRules.bookingWindowDays
   */
  async getAvailableSlots(
    tenantId:       string,
    professionalId: string,
    date:           string,   // YYYY-MM-DD in tenant's local timezone
    serviceIds:     string[], // ordered — determines booking sequence
    requestedBranchId?: string,
  ): Promise<SlotsResponse> {

    // ── 0. Resolve branch (validates ownership + single-branch fallback) ───
    // For multi-branch tenants the caller must send branchId; for single-
    // branch tenants we transparently fall back to the only active branch.
    const branchId = await this.branches.resolveBranchId(tenantId, requestedBranchId)

    // ── 1. Load professional + tenant ──────────────────────────────────────
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, tenantId, isActive: true },
      include: {
        tenant: {
          include: { scheduleRules: true },
        },
      },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    // Verify the professional actually atende en esta sucursal — otherwise
    // a multi-branch tenant could query slots for a pro that doesn't work
    // here and silently get an empty set, masking the misconfiguration.
    await this.branches.requireProfessionalInBranch(branchId, professionalId)

    const { tenant }       = professional
    const timezone         = tenant.timezone
    const slotIntervalMins = tenant.scheduleRules?.slotDurationMinutes ?? 15

    // ── 2. Load + validate services ────────────────────────────────────────
    const services = await this.resolveServices(tenantId, professionalId, serviceIds)

    // ── 3. Compute total duration ──────────────────────────────────────────
    // Structure: [bufferBefore₀][S0][bufferAfter₀][S1][bufferAfter₁]...
    // bufferBefore only applies to the first service (professional setup time).
    // bufferAfter applies to each service (cleanup / transition time).
    const totalDurationMins = this.computeTotalDuration(services)

    if (totalDurationMins <= 0) {
      throw new BadRequestException('La duración total debe ser mayor a 0')
    }

    // ── 4. Determine working window for this date ──────────────────────────
    const dayOfWeek = this.getDayOfWeek(date, timezone) // 0=Sun … 6=Sat

    // WorkSchedule lookup is BRANCH-scoped: the same professional can have
    // different hours per sucursal, so we filter by (professionalId,
    // branchId, dayOfWeek). Phase 1 backfilled branchId on every existing
    // row to the tenant's default branch, so this is safe across both phases.
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { professionalId, branchId, dayOfWeek, isActive: true },
    })

    if (!schedule) {
      return this.buildEmptyResponse(date, professionalId, branchId, timezone, totalDurationMins, slotIntervalMins, services, 'NOT_WORKING')
    }

    let workStartMins = this.timeToMinutes(schedule.startTime)
    let workEndMins   = this.timeToMinutes(schedule.endTime)

    // ── 5. Check schedule exceptions ──────────────────────────────────────
    // ScheduleException stays personal to the professional (no branchId):
    // a vacation or holiday applies across every sucursal where the pro
    // works. Same goes for partial-day blocks (a sick afternoon).
    const exceptions = await this.prisma.scheduleException.findMany({
      where: {
        professionalId,
        date: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lte: new Date(`${date}T23:59:59.999Z`),
        },
      },
    })

    for (const ex of exceptions) {
      // Full-day blocks (VACATION, HOLIDAY, or BLOCK without a time range)
      if (
        FULL_DAY_BLOCK_TYPES.includes(ex.type) ||
        (ex.type === ExceptionType.BLOCK && !ex.startTime && !ex.endTime)
      ) {
        return this.buildEmptyResponse(date, professionalId, branchId, timezone, totalDurationMins, slotIntervalMins, services, 'EXCEPTION_BLOCK')
      }

      // Custom hours override the work schedule for this specific date
      if (ex.type === ExceptionType.CUSTOM_HOURS && ex.startTime && ex.endTime) {
        workStartMins = this.timeToMinutes(ex.startTime)
        workEndMins   = this.timeToMinutes(ex.endTime)
      }
    }

    // ── 6. Resolve capacity (group bookings) ────────────────────────────
    const rawSvcs = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { maxParallelBookings: true },
    })
    const maxCapacity = Math.min(...rawSvcs.map(s => s.maxParallelBookings))
    const isGroup = maxCapacity > 1

    // ── 7. Collect busy intervals / appointment list ─────────────────────
    const dayStartUtc = this.localToUtc(date, '00:00', timezone)
    const dayEndUtc   = this.localToUtc(date, '23:59', timezone)

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        status:  { in: BLOCKING_STATUSES },
        startAt: { lt: dayEndUtc },
        endAt:   { gt: dayStartUtc },
      },
      select: { startAt: true, endAt: true },
    })

    const apptIntervals = appointments.map(appt => ({
      startMinutes: this.utcToLocalMinutes(appt.startAt, timezone),
      endMinutes:   this.utcToLocalMinutes(appt.endAt,   timezone),
    }))

    const blockIntervals: TimeInterval[] = exceptions
      .filter(ex => ex.type === ExceptionType.BLOCK && ex.startTime && ex.endTime)
      .map(ex => ({
        startMinutes: this.timeToMinutes(ex.startTime!),
        endMinutes:   this.timeToMinutes(ex.endTime!),
      }))

    // ── 8. Generate slots ──────────────────────────────────────────────────
    const slots: AvailableSlot[] = []
    const unavailableSlots: UnavailableSlot[] = []
    const now = new Date()
    let cursor = workStartMins

    while (cursor + totalDurationMins <= workEndMins) {
      const slotStart = cursor
      const slotEnd   = cursor + totalDurationMins

      const slotStartAt = this.localToUtc(date, this.minutesToTime(slotStart), timezone)

      if (slotStartAt <= now) {
        cursor += slotIntervalMins
        continue
      }

      const slotInterval: TimeInterval = { startMinutes: slotStart, endMinutes: slotEnd }

      const isBlocked = this.overlapsAny(slotInterval, blockIntervals)
      const overlappingCount = apptIntervals.filter(
        b => slotStart < b.endMinutes && b.startMinutes < slotEnd,
      ).length

      const remaining = maxCapacity - overlappingCount

      const slotData: AvailableSlot = {
        startAt:         slotStartAt.toISOString(),
        endAt:           this.localToUtc(date, this.minutesToTime(slotEnd), timezone).toISOString(),
        durationMinutes: totalDurationMins,
        ...(isGroup ? { capacity: maxCapacity, booked: overlappingCount, remainingCapacity: Math.max(0, remaining) } : {}),
      }

      if (!isBlocked && remaining > 0) {
        slots.push(slotData)
      } else {
        unavailableSlots.push(slotData)
      }

      cursor += slotIntervalMins
    }

    const unavailableReason: UnavailableReason | undefined =
      slots.length === 0 ? 'FULLY_BLOCKED' : undefined

    return {
      date,
      professionalId,
      branchId,
      timezone,
      totalDurationMinutes: totalDurationMins,
      slotIntervalMinutes:  slotIntervalMins,
      services,
      slots,
      unavailableSlots,
      unavailableReason,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Available days (lightweight month-level availability check)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns which days in a given month the professional is available to work.
   *
   * This is a lightweight check that considers:
   *   - WorkSchedule: does the professional have hours for this day-of-week at this branch?
   *   - ScheduleExceptions: is the day fully blocked (vacation, holiday, manual block)?
   *   - CUSTOM_HOURS exceptions: override a non-working day to be available.
   *
   * It does NOT check individual slot availability (appointments). That would
   * require running the full slot engine for each day, which is too expensive
   * for a calendar overview. Days marked available may still have all slots
   * taken — the user will see that when they click and get the slot grid.
   */
  async getAvailableDays(
    tenantId:       string,
    professionalId: string,
    month:          string,   // YYYY-MM
    requestedBranchId?: string,
  ): Promise<AvailableDaysResponse> {
    const branchId = await this.branches.resolveBranchId(tenantId, requestedBranchId)

    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, tenantId, isActive: true },
      include: { tenant: true },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    await this.branches.requireProfessionalInBranch(branchId, professionalId)

    const timezone = professional.tenant.timezone

    // Load all active work schedules for this branch (one per day-of-week)
    const schedules = await this.prisma.workSchedule.findMany({
      where: { professionalId, branchId, isActive: true },
    })
    const workingDays = new Set(schedules.map(s => s.dayOfWeek))

    // Load all exceptions for the month
    const [year, mon] = month.split('-').map(Number)
    const monthStart = new Date(`${month}-01T00:00:00.000Z`)
    const monthEnd   = new Date(year, mon, 0, 23, 59, 59, 999) // last day of month
    const exceptions = await this.prisma.scheduleException.findMany({
      where: {
        professionalId,
        date: { gte: monthStart, lte: monthEnd },
      },
    })

    // Index exceptions by date string (YYYY-MM-DD)
    const exceptionsByDate = new Map<string, typeof exceptions>()
    for (const ex of exceptions) {
      const key = ex.date.toISOString().slice(0, 10)
      const list = exceptionsByDate.get(key) ?? []
      list.push(ex)
      exceptionsByDate.set(key, list)
    }

    // Walk every day of the month
    const daysInMonth = new Date(year, mon, 0).getDate()
    const days: DayAvailability[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`
      const dayOfWeek = this.getDayOfWeek(dateStr, timezone)
      const dayExceptions = exceptionsByDate.get(dateStr) ?? []

      // Check for full-day blocking exceptions
      const fullBlock = dayExceptions.find(ex =>
        FULL_DAY_BLOCK_TYPES.includes(ex.type) ||
        (ex.type === ExceptionType.BLOCK && !ex.startTime && !ex.endTime),
      )

      if (fullBlock) {
        const reason = fullBlock.type === ExceptionType.VACATION ? 'VACATION'
          : fullBlock.type === ExceptionType.HOLIDAY ? 'HOLIDAY'
          : 'MANUAL_BLOCK'
        days.push({ date: dateStr, available: false, reason })
        continue
      }

      // Check for CUSTOM_HOURS (overrides non-working day)
      const hasCustomHours = dayExceptions.some(
        ex => ex.type === ExceptionType.CUSTOM_HOURS && ex.startTime && ex.endTime,
      )

      if (hasCustomHours || workingDays.has(dayOfWeek)) {
        days.push({ date: dateStr, available: true })
      } else {
        days.push({ date: dateStr, available: false, reason: 'NO_SCHEDULE' })
      }
    }

    return { month, professionalId, branchId, days }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load services in the requested order, validate they exist, belong to the tenant,
   * are active, and are offered by the professional.
   * Applies professional-level duration/price overrides when present.
   *
   * Public so AppointmentsService can reuse the same resolution logic
   * without duplicating service validation and override handling.
   */
  async resolveServices(
    tenantId:       string,
    professionalId: string,
    serviceIds:     string[],
  ): Promise<ServiceSnapshot[]> {
    const raw = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, isActive: true },
      include: {
        professionals: { where: { professionalId } },
      },
    })

    // Validate all requested services were found
    if (raw.length !== serviceIds.length) {
      const foundIds = new Set(raw.map(s => s.id))
      const missing  = serviceIds.filter(id => !foundIds.has(id))
      throw new BadRequestException(
        `Servicios no encontrados, inactivos o de otro negocio: ${missing.join(', ')}`,
      )
    }

    // Validate professional offers all requested services
    const notOffered = raw.filter(s => s.professionals.length === 0)
    if (notOffered.length > 0) {
      throw new BadRequestException(
        `El profesional no ofrece: ${notOffered.map(s => s.name).join(', ')}`,
      )
    }

    // Return in the caller-specified order with overrides applied
    return serviceIds.map(id => {
      const svc      = raw.find(s => s.id === id)!
      const override = svc.professionals[0] // professional-specific override (if any)
      return {
        id:              svc.id,
        name:            svc.name,
        durationMinutes: override.overrideDuration ?? svc.durationMinutes,
        bufferBefore:    svc.bufferBefore,
        bufferAfter:     svc.bufferAfter,
        price:           Number(override.overridePrice ?? svc.price),
      }
    })
  }

  /**
   * Total calendar block duration for a sequential multi-service booking.
   * Layout: [bufferBefore_0] [S0 duration] [S0 bufferAfter] [S1 duration] [S1 bufferAfter] ...
   *
   * bufferBefore only applies to the FIRST service (professional setup time before the session).
   * bufferAfter applies to EACH service (cleanup / transition between services).
   *
   * Public so AppointmentsService can compute endAt from the same formula.
   */
  computeTotalDuration(services: ServiceSnapshot[]): number {
    return services.reduce((total, svc, idx) => {
      const pre = idx === 0 ? svc.bufferBefore : 0
      return total + pre + svc.durationMinutes + svc.bufferAfter
    }, 0)
  }

  /**
   * Returns true if [slot] overlaps with any interval in [busy].
   * Two intervals [a,b) and [c,d) overlap when a < d AND c < b.
   */
  private overlapsAny(slot: TimeInterval, busy: TimeInterval[]): boolean {
    return busy.some(
      b => slot.startMinutes < b.endMinutes && b.startMinutes < slot.endMinutes,
    )
  }

  /**
   * "09:30" → 570 (minutes from midnight)
   */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  /**
   * 570 → "09:30"
   */
  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  /**
   * Returns the day of week (0=Sun … 6=Sat) for a given date in the specified timezone.
   * Uses noon UTC as anchor to avoid DST-at-midnight edge cases.
   */
  private getDayOfWeek(dateStr: string, timezone: string): number {
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const dayAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday:  'short',
    }).format(noon)

    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    return map[dayAbbr] ?? 0
  }

  /**
   * Convert a local date + "HH:MM" time to a UTC Date.
   *
   * Strategy: use noon on the target date as anchor to determine the UTC offset
   * for the given timezone (noon avoids DST transitions that occur at midnight).
   * Then apply the same offset to the target local time.
   *
   * Example (timezone = America/Argentina/Buenos_Aires, UTC-3):
   *   noon UTC=12:00 → local=09:00 → offset = +3h
   *   target local 09:00 → UTC = 12:00 ✓
   *
   * Note: for production apps with many DST-heavy timezones, consider luxon or date-fns-tz.
   */
  private localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
    // Anchor: noon UTC on the target date
    const noonUtc = new Date(`${dateStr}T12:00:00Z`)

    // Format noon UTC as it appears in the target timezone (Swedish locale = ISO-like format)
    const noonLocal = new Intl.DateTimeFormat('sv', {
      timeZone: timezone,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
    }).format(noonUtc)
    // noonLocal = "2026-04-01 09:00:00" for UTC-3

    // Parse the local noon as if it were UTC (to compute the offset)
    const noonLocalAsUtc = new Date(noonLocal.replace(' ', 'T') + 'Z')

    // offsetMs: how many ms to ADD to local time to reach UTC
    // For UTC-3: noonUtc(12:00) - noonLocal_as_UTC(09:00) = +3h ✓
    const offsetMs = noonUtc.getTime() - noonLocalAsUtc.getTime()

    // Apply the offset to the target local time
    const localTarget = new Date(`${dateStr}T${timeStr}:00Z`) // treated as UTC temporarily
    return new Date(localTarget.getTime() + offsetMs)
  }

  /**
   * Convert a UTC Date to minutes-from-midnight in the specified timezone.
   * Used to normalize appointment times for overlap checking.
   */
  private utcToLocalMinutes(utcDate: Date, timezone: string): number {
    const localStr = new Intl.DateTimeFormat('sv', {
      timeZone: timezone,
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
    }).format(utcDate)
    // "HH:mm"
    const [h, m] = localStr.split(':').map(Number)
    return h * 60 + m
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Access control helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifies that the professional exists, belongs to the tenant,
   * and that the caller has permission to modify their schedule.
   *
   * Allowed callers:
   *   - Tenant ADMIN (can manage any professional's schedule)
   *   - The professional themselves (userId === caller.sub)
   *   - Super admins
   */
  private async requireProfessionalAccess(
    tenantId:       string,
    professionalId: string,
    caller:         JwtPayload,
  ) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, tenantId, isActive: true },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    // Resolve role from DB (JWT doesn't carry it)
    let isAdmin = caller.isSuperAdmin
    if (!isAdmin) {
      const membership = await this.prisma.tenantUser.findUnique({
        where:  { userId_tenantId: { userId: caller.sub, tenantId } },
        select: { role: true },
      })
      isAdmin = membership?.role === TenantRole.ADMIN
    }

    if (!isAdmin && professional.userId !== caller.sub) {
      throw new ForbiddenException('No tenés permiso para modificar este horario')
    }

    return professional
  }

  /**
   * Converts "HH:MM" to minutes from midnight.
   * Validates that startTime is strictly before endTime.
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    const start = this.timeToMinutes(startTime)
    const end   = this.timeToMinutes(endTime)

    if (start >= end) {
      throw new BadRequestException(
        `startTime (${startTime}) debe ser anterior a endTime (${endTime})`,
      )
    }
  }

  /**
   * Validates that time fields are consistent with the exception type:
   * - CUSTOM_HOURS: requires both startTime and endTime
   * - BLOCK with only one time: both or neither must be provided
   * - VACATION / HOLIDAY: times are optional (ignored at availability level)
   */
  private validateExceptionTimes(
    type:       ExceptionType,
    startTime?: string,
    endTime?:   string,
  ): void {
    const hasStart = !!startTime
    const hasEnd   = !!endTime

    if (type === ExceptionType.CUSTOM_HOURS) {
      if (!hasStart || !hasEnd) {
        throw new BadRequestException('Las excepciones CUSTOM_HOURS requieren startTime y endTime')
      }
    }

    // Both or neither for time ranges
    if (hasStart !== hasEnd) {
      throw new BadRequestException('startTime y endTime deben proporcionarse ambos o ninguno')
    }

    // Validate order only when both are present
    if (hasStart && hasEnd) {
      this.validateTimeRange(startTime!, endTime!)
    }
  }

  private buildEmptyResponse(
    date:               string,
    professionalId:     string,
    branchId:           string,
    timezone:           string,
    totalDurationMins:  number,
    slotIntervalMins:   number,
    services:           ServiceSnapshot[],
    reason:             UnavailableReason,
  ): SlotsResponse {
    return {
      date,
      professionalId,
      branchId,
      timezone,
      totalDurationMinutes: totalDurationMins,
      slotIntervalMinutes:  slotIntervalMins,
      services,
      slots:                [],
      unavailableSlots:     [],
      unavailableReason:    reason,
    }
  }
}
