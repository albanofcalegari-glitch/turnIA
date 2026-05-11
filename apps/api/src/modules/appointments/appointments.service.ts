import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { Prisma, AppointmentStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { SchedulesService } from '../schedules/schedules.service'
import { BranchesService } from '../branches/branches.service'
import { LoyaltyService } from '../loyalty/loyalty.service'
import { GoogleCalendarService } from '../google-calendar/google-calendar.service'
import { OutlookCalendarService } from '../outlook-calendar/outlook-calendar.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'

// Statuses that occupy calendar time and must be considered for overlap.
// COMPLETED is included because an admin may mark a future appointment as
// completed before its actual time — the slot must remain blocked.
const BLOCKING: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
]

// Statuses that permanently close an appointment — rescheduling is not allowed.
const TERMINAL: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
]

// Discriminated union describing who is making the booking.
// Used to drive the client-resolution logic inside the transaction.
type ClientContext =
  | { kind: 'user'; userId: string; firstName: string; lastName: string; email: string }
  | { kind: 'guest'; name: string; email: string; phone?: string }

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulesService: SchedulesService,
    private readonly branches: BranchesService,
    private readonly loyalty: LoyaltyService,
    private readonly gcal: GoogleCalendarService,
    private readonly outlook: OutlookCalendarService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Create (with optimistic concurrency + DB-level guard)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Books a new appointment.
   *
   * Client resolution (integrated in Stage 2):
   *   - Authenticated (userId provided): upserts a Client keyed by
   *     (tenantId, userId). First booking creates the record; subsequent
   *     bookings reuse it. Client data (name, email) is sourced from the
   *     User account and never overwritten on update.
   *   - Guest (userId = null): looks up an existing guest Client by
   *     (tenantId, email, userId = null). Creates one if none exists.
   *     Deduplication is best-effort by email — intentional, because the DB
   *     allows multiple guests with the same email (different visits).
   *
   * The resolved clientId is always persisted on the Appointment row.
   * guestName / guestEmail / guestPhone are also stored as immutable
   * snapshots regardless of auth status.
   *
   * Concurrency strategy (two-layer defense):
   *
   *   Layer 1 — SERIALIZABLE transaction + overlap count:
   *     Counts active appointments that overlap [startAt, endAt). Under
   *     SERIALIZABLE isolation, PostgreSQL takes predicate locks on the
   *     scanned range: no concurrent transaction can insert an overlapping
   *     row between our count and our insert. If two requests enter the
   *     transaction simultaneously, at most one commits; the other is rolled
   *     back with P2034.
   *
   *   Layer 2 — partial unique index (uq_appointment_active_slot):
   *     Catches the edge case of two concurrent requests for the EXACT same
   *     startAt that both passed the overlap count. One INSERT wins; the
   *     other gets P2002.
   *
   * Both P2002 and P2034 are translated to HTTP 409 Conflict.
   */
  async create(
    tenantId: string,
    userId: string | null,   // JWT sub — null when the caller is a guest
    dto: CreateAppointmentDto,
    isAdminBooking = false,
  ) {
    const startAt = new Date(dto.startAt)

    // ── 0. Resolve branch (validates ownership + single-branch fallback) ──
    const branchId = await this.branches.resolveBranchId(tenantId, dto.branchId)

    // ── 1. Load professional + tenant config ─────────────────────────────
    const professional = await this.prisma.professional.findFirst({
      where: { id: dto.professionalId, tenantId, isActive: true },
      include: {
        tenant: { include: { scheduleRules: true } },
      },
    })
    if (!professional) {
      throw new NotFoundException('Profesional no encontrado')
    }
    if (!isAdminBooking && !professional.acceptsOnlineBooking) {
      throw new BadRequestException('Este profesional no acepta reservas online')
    }

    await this.branches.requireProfessionalInBranch(branchId, dto.professionalId)

    const { tenant } = professional
    const rules    = tenant.scheduleRules
    const isGuest  = !userId

    // ── 2. Guest booking validation ───────────────────────────────────────
    if (!isAdminBooking && isGuest) {
      if (!(rules?.allowGuestBooking ?? true)) {
        throw new ForbiddenException('Este negocio no permite reservas de invitados')
      }
      if (!dto.guestName || !dto.guestEmail) {
        throw new BadRequestException(
          'guestName y guestEmail son obligatorios para reservas de invitados',
        )
      }
    }

    // ── 3. Timing constraints (skipped for admin bookings) ───────────────
    if (!isAdminBooking) {
      const nowMs          = Date.now()
      const minAdvanceMins = rules?.minAdvanceMinutes ?? 5
      const windowDays     = rules?.bookingWindowDays ?? 0

      if (startAt.getTime() < nowMs + minAdvanceMins * 60_000) {
        throw new BadRequestException(
          `La reserva debe hacerse con al menos ${minAdvanceMins} minutos de anticipación`,
        )
      }
      if (windowDays > 0 && startAt.getTime() > nowMs + windowDays * 24 * 60 * 60_000) {
        throw new BadRequestException(
          `La reserva debe estar dentro de los próximos ${windowDays} días`,
        )
      }
    }

    // ── 4. Resolve services, compute duration and price ───────────────────
    const serviceIds   = dto.items.map(i => i.serviceId)
    const services     = await this.schedulesService.resolveServices(tenantId, dto.professionalId, serviceIds)
    const totalMinutes = this.schedulesService.computeTotalDuration(services)
    const endAt        = new Date(startAt.getTime() + totalMinutes * 60_000)
    const totalPrice   = services.reduce((sum, s) => sum + s.price, 0)

    // ── 4b. Resolve capacity for group bookings ──────────────────────────
    const rawServices = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { maxParallelBookings: true },
    })
    const maxCapacity = Math.min(...rawServices.map(s => s.maxParallelBookings))

    // ── 5. Initial status based on tenant configuration ───────────────────
    const autoConfirm = rules?.autoConfirm ?? true
    const status      = autoConfirm ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING
    const confirmedAt = autoConfirm ? new Date() : null

    // ── 6. Build client context (outside the transaction) ─────────────────
    let clientCtx: ClientContext | null = null
    let directClientId: string | null = null

    if (isAdminBooking && dto.clientId) {
      directClientId = dto.clientId
    } else if (dto.guestName && dto.guestEmail) {
      clientCtx = {
        kind:  'guest',
        name:  dto.guestName,
        email: dto.guestEmail,
        phone: dto.guestPhone,
      }
    } else if (userId) {
      const user = await this.prisma.user.findUnique({
        where:  { id: userId },
        select: { firstName: true, lastName: true, email: true },
      })
      if (!user) throw new NotFoundException('Cuenta de usuario no encontrada')
      clientCtx = { kind: 'user', userId, ...user }
    } else if (dto.guestName && dto.guestEmail) {
      clientCtx = {
        kind:  'guest',
        name:  dto.guestName,
        email: dto.guestEmail,
        phone: dto.guestPhone,
      }
    }

    // ── 7. Transaction: resolve client + overlap check + atomic insert ────
    let created: Awaited<ReturnType<typeof this.prisma.appointment.create>> | null = null
    let duplicateClient = false

    try {
      created = await this.prisma.$transaction(
        async (tx) => {
          const resolvedClientId = directClientId
            ?? (clientCtx ? await this.resolveClient(tx, tenantId, clientCtx) : null)

          if (resolvedClientId) {
            const dup = await tx.appointment.count({
              where: {
                tenantId,
                clientId:       resolvedClientId,
                professionalId: dto.professionalId,
                status:         { in: BLOCKING },
                startAt:        { lt: endAt },
                endAt:          { gt: startAt },
              },
            })
            if (dup > 0) {
              duplicateClient = true
              return null
            }
          }

          const overlap = await tx.appointment.count({
            where: {
              tenantId,
              professionalId: dto.professionalId,
              status:         { in: BLOCKING },
              startAt:        { lt: endAt },
              endAt:          { gt: startAt },
            },
          })

          if (overlap >= maxCapacity) return null

          return tx.appointment.create({
            data: {
              tenantId,
              branchId,
              clientId:       resolvedClientId,
              professionalId: dto.professionalId,
              status,
              startAt,
              endAt,
              totalMinutes,
              totalPrice,
              confirmedAt,
              notes:      dto.notes,
              guestName:  dto.guestName,
              guestEmail: dto.guestEmail,
              guestPhone: dto.guestPhone,
              items: {
                create: services.map((svc, idx) => ({
                  serviceId:       svc.id,
                  serviceName:     svc.name,
                  durationMinutes: svc.durationMinutes,
                  price:           svc.price,
                  order:           idx,
                })),
              },
            },
            include: {
              items:        { orderBy: { order: 'asc' } },
              professional: { select: { id: true, displayName: true, avatarUrl: true } },
              client:       { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Ese horario ya no está disponible')
        }
        if (err.code === 'P2034') {
          throw new ConflictException(
            'Conflicto de reserva, por favor elegí otro horario o intentá de nuevo',
          )
        }
      }
      throw err
    }

    if (!created) {
      if (duplicateClient) {
        throw new ConflictException('Este cliente ya tiene un turno en este horario')
      }
      throw new ConflictException('Ese horario ya no está disponible (sin cupos)')
    }

    this.gcal.syncAppointmentCreated(created.id).catch(() => {})
    this.outlook.syncAppointmentCreated(created.id).catch(() => {})

    return created
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reschedule (atomic: create replacement + mark original RESCHEDULED)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Moves an existing appointment to a new time slot, optionally changing
   * the professional and/or the services.
   *
   * Atomicity strategy — everything runs in ONE SERIALIZABLE transaction:
   *   1. Re-read the original appointment to confirm it is still reschedulable
   *      (guards against a concurrent cancel/complete arriving between our
   *       outside read and the transaction).
   *   2. Count active overlapping appointments for the NEW slot, excluding
   *      the original appointment itself (avoids self-conflict when the new
   *      time partially overlaps the old one).
   *   3. Create the new appointment with rescheduledFromId = original.id.
   *   4. Mark the original as RESCHEDULED.
   *
   * Steps 2–4 are protected by SERIALIZABLE isolation (predicate locking)
   * and a partial unique index — the same two-layer defence used in create().
   *
   * The transaction callback returns null in two scenarios that must not
   * throw NestJS exceptions directly inside the Prisma callback:
   *   - 'terminal': the original status changed before we entered the tx
   *   - 'conflict': the new slot is already taken
   *
   * A closure variable (terminalDetectedInTx) distinguishes them after the
   * transaction resolves, so the correct HTTP code is returned.
   *
   * Client carry-forward:
   *   clientId, guestName, guestEmail, guestPhone are always copied from the
   *   original — the person rescheduling is the same person who booked.
   */
  async reschedule(
    tenantId: string,
    originalId: string,
    dto: RescheduleAppointmentDto,
  ) {
    // ── 1. Load original (with items for service defaulting) ─────────────
    const original = await this.prisma.appointment.findFirst({
      where:   { id: originalId, tenantId },
      include: { items: { orderBy: { order: 'asc' } } },
    })
    if (!original) throw new NotFoundException('Turno no encontrado')

    if (TERMINAL.includes(original.status)) {
      throw new BadRequestException(
        `No se puede reprogramar un turno con estado ${original.status}`,
      )
    }

    // ── 2. Resolve professional + tenant rules ────────────────────────────
    const newProfessionalId = dto.professionalId ?? original.professionalId

    const professional = await this.prisma.professional.findFirst({
      where:   { id: newProfessionalId, tenantId, isActive: true },
      include: { tenant: { include: { scheduleRules: true } } },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    // Resolve branch for the rescheduled appointment.
    //
    // Precedence:
    //   1. dto.branchId (explicit override — caller wants a different sucursal)
    //   2. original.branchId (most common: same sucursal, just a new time)
    //   3. resolveBranchId fallback (single-branch tenant default)
    //
    // After phase 2 the database guarantees original.branchId is non-null,
    // but during phase 1 we still have to tolerate null and fall back.
    const requestedBranchId = dto.branchId ?? original.branchId ?? undefined
    const newBranchId = await this.branches.resolveBranchId(tenantId, requestedBranchId)
    await this.branches.requireProfessionalInBranch(newBranchId, newProfessionalId)

    const rules   = professional.tenant.scheduleRules
    const startAt = new Date(dto.startAt)

    // ── 3. Timing constraints (same as create) ────────────────────────────
    const nowMs          = Date.now()
    const minAdvanceMins = rules?.minAdvanceMinutes ?? 5
    const windowDays     = rules?.bookingWindowDays ?? 0

    if (startAt.getTime() < nowMs + minAdvanceMins * 60_000) {
      throw new BadRequestException(
        `La reprogramación debe ser con al menos ${minAdvanceMins} minutos de anticipación`,
      )
    }
    if (windowDays > 0 && startAt.getTime() > nowMs + windowDays * 24 * 60 * 60_000) {
      throw new BadRequestException(
        `La reprogramación debe estar dentro de los próximos ${windowDays} días`,
      )
    }

    // ── 4. Resolve services, compute duration and price ───────────────────
    const serviceIds = dto.items
      ? dto.items.map(i => i.serviceId)
      : original.items.map(i => i.serviceId)

    const services     = await this.schedulesService.resolveServices(tenantId, newProfessionalId, serviceIds)
    const totalMinutes = this.schedulesService.computeTotalDuration(services)
    const endAt        = new Date(startAt.getTime() + totalMinutes * 60_000)
    const totalPrice   = services.reduce((sum, s) => sum + s.price, 0)

    // ── 5. Initial status for the new appointment ─────────────────────────
    const autoConfirm = rules?.autoConfirm ?? true
    const status      = autoConfirm ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING
    const confirmedAt = autoConfirm ? new Date() : null

    // ── 6. Transaction: re-verify + overlap check + create + mark original ─
    //
    // terminalDetectedInTx is set to true when the tx re-read reveals the
    // original was moved to a terminal state after our outside check.
    // This lets us return the correct HTTP code after the tx resolves.
    let terminalDetectedInTx = false
    let newAppointment: Awaited<ReturnType<typeof this.prisma.appointment.create>> | null = null

    try {
      newAppointment = await this.prisma.$transaction(
        async (tx) => {
          // Re-read original inside the SERIALIZABLE snapshot to guard against
          // a concurrent state change between our initial check and now.
          const current = await tx.appointment.findUnique({
            where:  { id: originalId },
            select: { status: true },
          })

          if (!current || TERMINAL.includes(current.status as AppointmentStatus)) {
            terminalDetectedInTx = true
            return null
          }

          // Count active appointments that would overlap the new window,
          // excluding the original so an adjacent slot change doesn't
          // conflict with its own (soon-to-be-vacated) time.
          const overlap = await tx.appointment.count({
            where: {
              tenantId,
              professionalId: newProfessionalId,
              status:         { in: BLOCKING },
              startAt:        { lt: endAt },
              endAt:          { gt: startAt },
              id:             { not: originalId },
            },
          })

          if (overlap > 0) return null

          // Create the replacement appointment.
          const created = await tx.appointment.create({
            data: {
              tenantId,
              branchId:          newBranchId,
              clientId:          original.clientId,
              professionalId:    newProfessionalId,
              status,
              startAt,
              endAt,
              totalMinutes,
              totalPrice,
              confirmedAt,
              notes:             original.notes,
              // Carry forward guest snapshots unchanged — same person, new time.
              guestName:         original.guestName,
              guestEmail:        original.guestEmail,
              guestPhone:        original.guestPhone,
              rescheduledFromId: originalId,
              items: {
                create: services.map((svc, idx) => ({
                  serviceId:       svc.id,
                  serviceName:     svc.name,
                  durationMinutes: svc.durationMinutes,
                  price:           svc.price,
                  order:           idx,
                })),
              },
            },
            include: {
              items:        { orderBy: { order: 'asc' } },
              professional: { select: { id: true, displayName: true, avatarUrl: true } },
              client:       { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          })

          // Atomically retire the original.
          await tx.appointment.update({
            where: { id: originalId },
            data:  { status: AppointmentStatus.RESCHEDULED },
          })

          return created
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Ese horario ya no está disponible')
        }
        if (err.code === 'P2034') {
          throw new ConflictException(
            'Conflicto de reserva, por favor elegí otro horario o intentá de nuevo',
          )
        }
      }
      throw err
    }

    if (!newAppointment) {
      if (terminalDetectedInTx) {
        throw new BadRequestException(
          'No se puede reprogramar: el estado del turno cambió concurrentemente',
        )
      }
      throw new ConflictException('Ese horario ya no está disponible')
    }

    this.gcal.syncAppointmentCancelled(originalId).catch(() => {})
    this.gcal.syncAppointmentCreated(newAppointment.id).catch(() => {})
    this.outlook.syncAppointmentCancelled(originalId).catch(() => {})
    this.outlook.syncAppointmentCreated(newAppointment.id).catch(() => {})

    return newAppointment
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Client resolution (called inside the booking transaction)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Finds or creates a Client record within an active Prisma transaction.
   *
   * Authenticated user path:
   *   Uses Prisma upsert on the compound unique key (tenantId, userId).
   *   Existing client data is never overwritten (update: {}) — name and email
   *   changes on the User account do not retroactively alter the client record.
   *
   * Guest path:
   *   Looks up an existing guest Client by (tenantId, email, userId = null)
   *   to avoid creating duplicate CRM records for repeat guests who don't
   *   create an account. Creates a new record if none is found.
   *
   * Always returns a valid Client.id (never null), so every new appointment
   * has a linked CRM record from day one.
   */
  private async resolveClient(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ctx: ClientContext,
  ): Promise<string> {
    if (ctx.kind === 'user') {
      const client = await tx.client.upsert({
        where:  { tenantId_userId: { tenantId, userId: ctx.userId } },
        create: {
          tenantId,
          userId:    ctx.userId,
          firstName: ctx.firstName,
          lastName:  ctx.lastName,
          email:     ctx.email,
        },
        update: {},  // Never overwrite existing CRM data on re-booking
        select: { id: true },
      })
      return client.id
    }

    // Guest path: best-effort deduplication by email within the tenant.
    // The DB intentionally has no unique constraint on (tenantId, email)
    // for guests (NULL userId), so this is an application-level check only.
    const { name, email, phone } = ctx
    const { firstName, lastName } = this.splitGuestName(name)

    const existing = await tx.client.findFirst({
      where:  { tenantId, userId: null, email },
      select: { id: true },
    })
    if (existing) return existing.id

    const created = await tx.client.create({
      data:   { tenantId, firstName, lastName, email, phone },
      select: { id: true },
    })
    return created.id
  }

  /**
   * Splits a full name string into firstName / lastName components.
   * For single-word names both fields receive the same value.
   */
  private splitGuestName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/)
    return {
      firstName: parts[0],
      lastName:  parts.length > 1 ? parts.slice(1).join(' ') : parts[0],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read helpers
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filters?: { professionalId?: string; branchId?: string; date?: string; from?: string; to?: string },
  ) {
    let dateFilter: Record<string, unknown> | undefined

    if (filters?.from || filters?.date) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { timezone: true },
      })
      const tz = tenant?.timezone ?? 'America/Argentina/Buenos_Aires'

      if (filters?.from && filters?.to) {
        dateFilter = {
          startAt: {
            gte: this.localMidnightToUtc(filters.from, '00:00', tz),
            lt:  this.localMidnightToUtc(filters.to,   '23:59', tz),
          },
        }
      } else if (filters?.date) {
        dateFilter = {
          startAt: {
            gte: this.localMidnightToUtc(filters.date, '00:00', tz),
            lt:  this.localMidnightToUtc(filters.date, '23:59', tz),
          },
        }
      }
    }

    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        ...(filters?.professionalId && { professionalId: filters.professionalId }),
        // branchId is intentionally NOT auto-resolved here: the agenda
        // endpoint may legitimately want to see appointments across all
        // sucursales (admin overview). Pass branchId only when the caller
        // wants to scope the agenda to a single sucursal.
        ...(filters?.branchId && { branchId: filters.branchId }),
        ...dateFilter,
      },
      include: {
        items:        { include: { service: true }, orderBy: { order: 'asc' } },
        professional: true,
        branch:       { select: { id: true, name: true } },
        client: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            loyaltyCard: { select: { id: true, stampsCount: true, rewardsAvailable: true } },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    })
  }

  async findOne(tenantId: string, id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where:   { id, tenantId },
      include: {
        items:        { include: { service: true }, orderBy: { order: 'asc' } },
        professional: true,
        client:       true,
      },
    })
    if (!appt) throw new NotFoundException('Turno no encontrado')
    return appt
  }

  /**
   * Find active appointments by guest email (public — no auth required).
   * Only returns PENDING and CONFIRMED appointments in the future.
   */
  async findByGuestEmail(tenantId: string, email: string) {
    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        guestEmail: email,
        status:     { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        startAt:    { gte: new Date() },
      },
      include: {
        items:        { include: { service: true }, orderBy: { order: 'asc' } },
        professional: { select: { id: true, displayName: true } },
      },
      orderBy: { startAt: 'asc' },
    })
  }

  /**
   * Cancel an appointment as a guest — verifies the email matches before cancelling.
   */
  async guestCancel(tenantId: string, id: string, email: string, reason?: string) {
    const appt = await this.findOne(tenantId, id)

    if (appt.guestEmail !== email) {
      throw new ForbiddenException('El email no corresponde a este turno')
    }

    if (appt.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Este turno ya fue cancelado')
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status:             AppointmentStatus.CANCELLED,
        cancelledAt:        new Date(),
        cancellationReason: reason ?? 'Cancelado por el cliente',
      },
    })
  }

  async cancel(tenantId: string, id: string, cancelledBy: string, reason?: string) {
    const existing = await this.findOne(tenantId, id)
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.appointment.update({
        where: { id },
        data: {
          status:             AppointmentStatus.CANCELLED,
          cancelledAt:        new Date(),
          cancelledBy,
          cancellationReason: reason,
        },
      })
      if (existing.status === AppointmentStatus.COMPLETED && existing.clientId) {
        await this.loyalty.reverseStampForAppointment(tx, {
          tenantId,
          appointmentId: id,
          clientId:      existing.clientId,
        })
      }
      return u
    })

    this.gcal.syncAppointmentCancelled(id).catch(() => {})
    this.outlook.syncAppointmentCancelled(id).catch(() => {})

    return updated
  }

  async confirm(tenantId: string, id: string) {
    await this.findOne(tenantId, id)
    return this.prisma.appointment.update({
      where: { id },
      data:  { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
    })
  }

  async complete(tenantId: string, id: string, paymentMethod?: string) {
    const existing = await this.findOne(tenantId, id)
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where:   { id },
        data:    { status: AppointmentStatus.COMPLETED, completedAt: new Date(), paymentMethod: paymentMethod ?? null },
        include: { items: { select: { serviceId: true } } },
      })
      // Emitir stamp sólo si hay cliente registrado. Para guests sin cuenta no
      // tiene sentido (no hay manera de recuperar su tarjeta).
      if (existing.clientId) {
        await this.loyalty.issueStampForAppointment(tx, {
          tenantId,
          appointmentId: id,
          clientId:      existing.clientId,
          serviceIds:    updated.items.map(i => i.serviceId),
        })
      }
      return updated
    })
  }

  async noShow(tenantId: string, id: string) {
    await this.findOne(tenantId, id)
    return this.prisma.appointment.update({
      where: { id },
      data:  { status: AppointmentStatus.NO_SHOW },
    })
  }

  /**
   * Reverts a terminal appointment (COMPLETED / NO_SHOW / CANCELLED) back to
   * CONFIRMED. Use case: the operator mis-clicked or the client actually did
   * show up. Clears completed/cancelled metadata so the timeline stays honest.
   */
  async reopen(tenantId: string, id: string) {
    const appt = await this.findOne(tenantId, id)
    const reopenable: AppointmentStatus[] = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.CANCELLED,
    ]
    if (!reopenable.includes(appt.status)) {
      return appt
    }
    return this.prisma.appointment.update({
      where: { id },
      data:  {
        status:             AppointmentStatus.CONFIRMED,
        completedAt:        null,
        cancelledAt:        null,
        cancelledBy:        null,
        cancellationReason: null,
      },
    })
  }

  private localMidnightToUtc(dateStr: string, timeStr: string, timezone: string): Date {
    const noonUtc = new Date(`${dateStr}T12:00:00Z`)
    const noonLocal = new Intl.DateTimeFormat('sv', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(noonUtc)
    const noonLocalAsUtc = new Date(noonLocal.replace(' ', 'T') + 'Z')
    const offsetMs = noonUtc.getTime() - noonLocalAsUtc.getTime()
    const localTarget = new Date(`${dateStr}T${timeStr}:00Z`)
    return new Date(localTarget.getTime() + offsetMs)
  }
}
