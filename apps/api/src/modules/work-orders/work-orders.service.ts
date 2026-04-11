import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  DurationUnit,
  WorkOrderStatus,
  WorkSlotStatus,
  AppointmentStatus,
  ExceptionType,
} from '@prisma/client'
import { BranchesService } from '../branches/branches.service'
import { CreateWorkOrderDto } from './dto/create-work-order.dto'

/** Active statuses that block professional time */
const ACTIVE_WO_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.PENDING,
  WorkOrderStatus.CONFIRMED,
  WorkOrderStatus.IN_PROGRESS,
]

const ACTIVE_APPT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
]

/** Full-day exception types that prevent any work */
const FULL_DAY_BLOCK_TYPES: ExceptionType[] = [
  ExceptionType.VACATION,
  ExceptionType.HOLIDAY,
]

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a WorkOrder with auto-generated WorkSlots.
   *
   * 1. Validate the service is "complex" (multi-pro or multi-day).
   * 2. Compute how many workdays are needed.
   * 3. Walk forward from startDate, skipping non-working days (no schedule
   *    or full-day exceptions), to generate one WorkSlot per day.
   * 4. Create the WorkOrder + WorkSlots in a single transaction.
   *
   * Staff assignment is NOT automatic in Phase 1 — the admin assigns
   * professionals to each slot manually after creation.
   */
  async create(tenantId: string, dto: CreateWorkOrderDto) {
    // ── 0. Resolve branch ──────────────────────────────────────────────
    const branchId = await this.branches.resolveBranchId(tenantId, dto.branchId)

    // ── 1. Load service + tenant ───────────────────────────────────────
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId, isActive: true },
    })
    if (!service) throw new NotFoundException('Servicio no encontrado')

    // Guard: only complex services use WorkOrder
    if (service.minProfessionals <= 1 && !service.allowsMultiDay) {
      throw new BadRequestException(
        'Este servicio es simple (1 profesional, intra-día). Usá el flujo de turnos normales.',
      )
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    })

    // ── 2. Compute effective duration ──────────────────────────────────
    const wdHours = Number(service.workdayHours ?? tenant.defaultWorkdayHours)
    const wdMinutes = wdHours * 60
    const { totalMinutes, totalWorkdays } = this.computeEffectiveDuration(
      service.durationUnit as DurationUnit,
      Number(service.durationValue),
      service.durationMinutes,
      wdMinutes,
    )

    // ── 3. Generate work slots by walking working days ─────────────────
    const timezone = tenant.timezone
    const startDateStr = dto.startDate.slice(0, 10) // "YYYY-MM-DD"
    const slotDefs = await this.computeWorkSlotDates(
      branchId,
      startDateStr,
      totalWorkdays,
      wdMinutes,
      timezone,
    )

    if (slotDefs.length === 0) {
      throw new BadRequestException(
        'No se encontraron días laborables disponibles desde la fecha indicada.',
      )
    }

    // ── 4. Validate client if provided ─────────────────────────────────
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId },
      })
      if (!client) throw new NotFoundException('Cliente no encontrado')
    }

    // ── 5. Create WorkOrder + WorkSlots ────────────────────────────────
    const price = dto.totalPrice ?? Number(service.price)
    const workOrder = await this.prisma.workOrder.create({
      data: {
        tenantId,
        branchId,
        serviceId: service.id,
        clientId: dto.clientId ?? null,
        status: WorkOrderStatus.PENDING,
        scheduledStartAt: slotDefs[0].startAt,
        scheduledEndAt: slotDefs[slotDefs.length - 1].endAt,
        totalPrice: price,
        estimatedMinutes: totalMinutes,
        notes: dto.notes,
        workSlots: {
          create: slotDefs.map(s => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            startAt: s.startAt,
            endAt: s.endAt,
          })),
        },
      },
      include: {
        workSlots: { orderBy: { date: 'asc' }, include: { assignments: { include: { professional: true } } } },
        service: true,
        client: true,
        branch: true,
      },
    })

    return workOrder
  }

  async findAll(
    tenantId: string,
    filters: {
      status?: string
      branchId?: string
      from?: string
      to?: string
    },
  ) {
    const where: any = { tenantId }
    if (filters.status) where.status = filters.status
    if (filters.branchId) where.branchId = filters.branchId
    if (filters.from || filters.to) {
      where.scheduledStartAt = {}
      if (filters.from) where.scheduledStartAt.gte = new Date(filters.from)
      if (filters.to) where.scheduledStartAt.lte = new Date(filters.to)
    }

    return this.prisma.workOrder.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        workSlots: {
          orderBy: { date: 'asc' },
          include: {
            assignments: {
              include: { professional: { select: { id: true, displayName: true, color: true } } },
            },
          },
        },
      },
      orderBy: { scheduledStartAt: 'asc' },
    })
  }

  async findOne(tenantId: string, id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      include: {
        service: true,
        client: true,
        branch: true,
        workSlots: {
          orderBy: { date: 'asc' },
          include: {
            assignments: {
              include: { professional: true },
            },
          },
        },
      },
    })
    if (!wo) throw new NotFoundException('Orden de trabajo no encontrada')
    return wo
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Status transitions
  // ─────────────────────────────────────────────────────────────────────────

  async updateStatus(tenantId: string, id: string, newStatus: WorkOrderStatus) {
    const wo = await this.findOne(tenantId, id)
    this.validateTransition(wo.status, newStatus)

    // CONFIRMED requires all slots to have minProfessionals assigned
    if (newStatus === WorkOrderStatus.CONFIRMED) {
      const service = await this.prisma.service.findUniqueOrThrow({
        where: { id: wo.serviceId },
      })
      for (const slot of wo.workSlots) {
        if (slot.assignments.length < service.minProfessionals) {
          throw new BadRequestException(
            `El tramo del ${this.formatDate(slot.date)} tiene ${slot.assignments.length} profesional(es) asignado(s), ` +
            `pero el servicio requiere mínimo ${service.minProfessionals}. ` +
            `Asigná profesionales a todos los tramos antes de confirmar.`,
          )
        }
      }
    }

    const data: any = { status: newStatus }
    if (newStatus === WorkOrderStatus.CONFIRMED) data.confirmedAt = new Date()
    if (newStatus === WorkOrderStatus.COMPLETED) data.completedAt = new Date()
    if (newStatus === WorkOrderStatus.CANCELLED) data.cancelledAt = new Date()

    return this.prisma.workOrder.update({
      where: { id },
      data,
      include: {
        workSlots: {
          orderBy: { date: 'asc' },
          include: { assignments: { include: { professional: true } } },
        },
        service: true,
        client: true,
      },
    })
  }

  private validateTransition(current: WorkOrderStatus, next: WorkOrderStatus) {
    const allowed: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      [WorkOrderStatus.PENDING]:     [WorkOrderStatus.CONFIRMED, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.CONFIRMED]:   [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.COMPLETED]:   [],
      [WorkOrderStatus.CANCELLED]:   [],
    }
    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(
        `No se puede pasar de "${current}" a "${next}".`,
      )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Staff assignment
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assign a professional to a specific WorkSlot.
   *
   * Validates:
   * - WorkOrder belongs to tenant and is not completed/cancelled
   * - Professional belongs to tenant, is active, offers the service, and works at the branch
   * - Professional is not already assigned to this slot
   * - Slot hasn't exceeded maxProfessionals
   * - Professional has no time conflict (appointment or other work-order assignment)
   */
  async assignProfessional(
    tenantId: string,
    workOrderId: string,
    slotId: string,
    professionalId: string,
  ) {
    const wo = await this.findOne(tenantId, workOrderId)

    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede modificar una orden completada o cancelada.')
    }

    const slot = wo.workSlots.find(s => s.id === slotId)
    if (!slot) throw new NotFoundException('Tramo no encontrado en esta orden')

    // Validate professional
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, tenantId, isActive: true },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    // Verify professional works at this branch
    await this.branches.requireProfessionalInBranch(wo.branchId, professionalId)

    // Verify professional offers this service
    const proService = await this.prisma.professionalService.findUnique({
      where: {
        professionalId_serviceId: { professionalId, serviceId: wo.serviceId },
      },
    })
    if (!proService) {
      throw new BadRequestException('El profesional no ofrece este servicio.')
    }

    // Check max professionals
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: wo.serviceId },
    })
    if (slot.assignments.length >= service.maxProfessionals) {
      throw new BadRequestException(
        `Este tramo ya tiene el máximo de profesionales (${service.maxProfessionals}).`,
      )
    }

    // Check for time conflicts
    await this.checkProfessionalAvailability(professionalId, tenantId, slot.startAt, slot.endAt)

    // Create assignment
    try {
      const assignment = await this.prisma.staffAssignment.create({
        data: { workSlotId: slotId, professionalId },
        include: { professional: true },
      })
      return assignment
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Este profesional ya está asignado a este tramo.')
      }
      throw err
    }
  }

  /**
   * Remove a professional from a specific WorkSlot.
   * Validates that the slot won't drop below minProfessionals if the order
   * is already CONFIRMED or IN_PROGRESS.
   */
  async unassignProfessional(
    tenantId: string,
    workOrderId: string,
    slotId: string,
    professionalId: string,
  ) {
    const wo = await this.findOne(tenantId, workOrderId)

    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede modificar una orden completada o cancelada.')
    }

    const slot = wo.workSlots.find(s => s.id === slotId)
    if (!slot) throw new NotFoundException('Tramo no encontrado en esta orden')

    const assignment = await this.prisma.staffAssignment.findUnique({
      where: {
        workSlotId_professionalId: { workSlotId: slotId, professionalId },
      },
    })
    if (!assignment) {
      throw new NotFoundException('El profesional no está asignado a este tramo.')
    }

    // If order is confirmed or in progress, check minProfessionals
    if (
      wo.status === WorkOrderStatus.CONFIRMED ||
      wo.status === WorkOrderStatus.IN_PROGRESS
    ) {
      const service = await this.prisma.service.findUniqueOrThrow({
        where: { id: wo.serviceId },
      })
      const remaining = slot.assignments.length - 1
      if (remaining < service.minProfessionals) {
        throw new BadRequestException(
          `No se puede quitar: el tramo quedaría con ${remaining} profesional(es), ` +
          `pero el mínimo requerido es ${service.minProfessionals}.`,
        )
      }
    }

    await this.prisma.staffAssignment.delete({ where: { id: assignment.id } })
    return { success: true }
  }

  /**
   * List professionals available for a specific WorkSlot.
   * Useful for the assignment UI to show only valid options.
   */
  async getAvailableProfessionals(tenantId: string, workOrderId: string, slotId: string) {
    const wo = await this.findOne(tenantId, workOrderId)
    const slot = wo.workSlots.find(s => s.id === slotId)
    if (!slot) throw new NotFoundException('Tramo no encontrado en esta orden')

    // Get all professionals who:
    // 1. Belong to the tenant and are active
    // 2. Offer the service
    // 3. Work at the branch
    const candidates = await this.prisma.professional.findMany({
      where: {
        tenantId,
        isActive: true,
        services: { some: { serviceId: wo.serviceId } },
        branches: { some: { branchId: wo.branchId } },
      },
      select: { id: true, displayName: true, color: true },
    })

    // Filter out those already assigned to this slot
    const assignedIds = new Set(slot.assignments.map(a => a.professionalId))

    // Filter out those with time conflicts
    const available: typeof candidates = []
    for (const pro of candidates) {
      if (assignedIds.has(pro.id)) continue
      const hasConflict = await this.hasProfessionalConflict(
        pro.id, tenantId, slot.startAt, slot.endAt,
      )
      if (!hasConflict) available.push(pro)
    }

    return available
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers — Duration computation
  // ─────────────────────────────────────────────────────────────────────────

  private computeEffectiveDuration(
    unit: DurationUnit,
    value: number,
    legacyMinutes: number,
    wdMinutes: number,
  ): { totalMinutes: number; totalWorkdays: number } {
    // Backwards compat: if durationValue is 0, use the legacy durationMinutes
    if (value === 0 || unit === DurationUnit.MINUTES) {
      const mins = value > 0 ? value : legacyMinutes
      return {
        totalMinutes: mins,
        totalWorkdays: Math.ceil(mins / wdMinutes),
      }
    }
    if (unit === DurationUnit.HOURS) {
      const mins = value * 60
      return {
        totalMinutes: mins,
        totalWorkdays: Math.ceil(mins / wdMinutes),
      }
    }
    // WORKDAYS
    return {
      totalMinutes: value * wdMinutes,
      totalWorkdays: value,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers — Work slot date computation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Walk forward from `startDate`, collecting working days until we have
   * `totalWorkdays` slots. Skips days without a WorkSchedule for the branch
   * and days with full-day exceptions.
   *
   * Returns an array of slot definitions with local times + UTC timestamps.
   */
  private async computeWorkSlotDates(
    branchId: string,
    startDate: string,
    totalWorkdays: number,
    wdMinutes: number,
    timezone: string,
  ): Promise<Array<{
    date: Date
    startTime: string
    endTime: string
    startAt: Date
    endAt: Date
  }>> {
    // Load all branch work schedules
    const schedules = await this.prisma.workSchedule.findMany({
      where: { branchId, isActive: true },
    })
    const scheduleByDay = new Map(schedules.map(s => [s.dayOfWeek, s]))

    const slots: Array<{
      date: Date
      startTime: string
      endTime: string
      startAt: Date
      endAt: Date
    }> = []

    let cursor = new Date(`${startDate}T12:00:00Z`) // noon UTC as anchor
    const maxDaysToSearch = 60 // safety limit: don't look more than 60 days ahead

    for (let i = 0; i < maxDaysToSearch && slots.length < totalWorkdays; i++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const dayOfWeek = this.getDayOfWeek(dateStr, timezone)
      const schedule = scheduleByDay.get(dayOfWeek)

      if (schedule) {
        // Check for full-day exceptions on this date
        const hasBlock = await this.hasFullDayBlock(dateStr)
        if (!hasBlock) {
          // Check for custom hours override
          const customHours = await this.getCustomHours(dateStr, branchId)
          const startTime = customHours?.startTime ?? schedule.startTime
          const endTime = customHours?.endTime ?? schedule.endTime

          // Compute how many minutes this day provides
          const dayMinutes = this.timeToMinutes(endTime) - this.timeToMinutes(startTime)

          // Only use this day if it provides meaningful work time
          if (dayMinutes > 0) {
            // For the last day, we might need fewer hours
            const remainingMinutes = (totalWorkdays - slots.length) * wdMinutes
            // Use the full day window (the service occupies the whole workday)
            const effectiveEndTime = endTime

            slots.push({
              date: new Date(`${dateStr}T00:00:00Z`),
              startTime,
              endTime: effectiveEndTime,
              startAt: this.localToUtc(dateStr, startTime, timezone),
              endAt: this.localToUtc(dateStr, effectiveEndTime, timezone),
            })
          }
        }
      }

      // Advance to next day
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }

    return slots
  }

  private async hasFullDayBlock(dateStr: string): Promise<boolean> {
    const count = await this.prisma.scheduleException.count({
      where: {
        date: {
          gte: new Date(`${dateStr}T00:00:00.000Z`),
          lte: new Date(`${dateStr}T23:59:59.999Z`),
        },
        OR: [
          { type: { in: FULL_DAY_BLOCK_TYPES } },
          { type: ExceptionType.BLOCK, startTime: null, endTime: null },
        ],
      },
    })
    return count > 0
  }

  private async getCustomHours(
    dateStr: string,
    _branchId: string,
  ): Promise<{ startTime: string; endTime: string } | null> {
    const exception = await this.prisma.scheduleException.findFirst({
      where: {
        date: {
          gte: new Date(`${dateStr}T00:00:00.000Z`),
          lte: new Date(`${dateStr}T23:59:59.999Z`),
        },
        type: ExceptionType.CUSTOM_HOURS,
        startTime: { not: null },
        endTime: { not: null },
      },
    })
    if (!exception?.startTime || !exception?.endTime) return null
    return { startTime: exception.startTime, endTime: exception.endTime }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers — Conflict checking
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a professional has any time conflict in [startAt, endAt).
   * Checks both Appointments and StaffAssignments.
   * Throws ConflictException if busy.
   */
  private async checkProfessionalAvailability(
    professionalId: string,
    tenantId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<void> {
    const hasConflict = await this.hasProfessionalConflict(
      professionalId, tenantId, startAt, endAt,
    )
    if (hasConflict) {
      throw new ConflictException(
        'El profesional tiene un conflicto horario en ese tramo (turno u otra orden de trabajo).',
      )
    }
  }

  /**
   * Returns true if the professional has any overlapping commitment.
   * Branch-agnostic (same professional can't be in two places at once).
   */
  private async hasProfessionalConflict(
    professionalId: string,
    tenantId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<boolean> {
    // Check appointments
    const appointmentConflict = await this.prisma.appointment.count({
      where: {
        professionalId,
        status: { in: ACTIVE_APPT_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    })
    if (appointmentConflict > 0) return true

    // Check work order assignments
    const assignmentConflict = await this.prisma.staffAssignment.count({
      where: {
        professionalId,
        workSlot: {
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          workOrder: {
            tenantId,
            status: { in: ACTIVE_WO_STATUSES },
          },
        },
      },
    })
    return assignmentConflict > 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers — Timezone (same patterns as SchedulesService)
  // ─────────────────────────────────────────────────────────────────────────

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  private getDayOfWeek(dateStr: string, timezone: string): number {
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const dayAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(noon)
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    return map[dayAbbr] ?? 0
  }

  private localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
    const noonUtc = new Date(`${dateStr}T12:00:00Z`)
    const noonLocal = new Intl.DateTimeFormat('sv', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(noonUtc)
    const noonLocalAsUtc = new Date(noonLocal.replace(' ', 'T') + 'Z')
    const offsetMs = noonUtc.getTime() - noonLocalAsUtc.getTime()
    const localTarget = new Date(`${dateStr}T${timeStr}:00Z`)
    return new Date(localTarget.getTime() + offsetMs)
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }
}
