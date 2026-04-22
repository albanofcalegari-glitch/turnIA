import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateProfessionalDto } from './dto/create-professional.dto'
import { PLANS, type PlanTier } from '@turnia/shared'

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Professional record, optionally linked to a User account.
   *
   * - If dto.userId is provided → validates user exists and belongs to tenant.
   * - If omitted → creates an unlinked professional (staff without system account).
   */
  async create(tenantId: string, callerId: string, dto: CreateProfessionalDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { plan: true },
    })
    const plan = PLANS[(tenant?.plan ?? 'standard') as keyof typeof PLANS]
    if (plan?.maxProfessionals !== null) {
      const currentCount = await this.prisma.professional.count({
        where: { tenantId, isActive: true },
      })
      if (currentCount >= (plan?.maxProfessionals ?? 1)) {
        throw new ForbiddenException(
          `Tu plan ${plan?.label ?? 'Estándar'} permite hasta ${plan?.maxProfessionals ?? 1} profesional${(plan?.maxProfessionals ?? 1) === 1 ? '' : 'es'}. Actualizá a Pro para agregar más.`,
        )
      }
    }

    const userId = dto.userId ?? null

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true },
      })
      if (!user) throw new NotFoundException('Usuario no encontrado')

      const membership = await this.prisma.tenantUser.findUnique({
        where:  { userId_tenantId: { userId, tenantId } },
        select: { role: true },
      })
      if (!membership) {
        throw new BadRequestException('El usuario no es miembro de este negocio')
      }
    }

    try {
      // Auto-link new professional to every active branch of the tenant.
      // Without this, Schedules and appointment creation fail with
      // "El profesional no atiende en esta sucursal" because
      // requireProfessionalInBranch needs the join row. Admin can unlink
      // later via the dashboard (pending UI — see sucursales/page.tsx).
      return await this.prisma.$transaction(async (tx) => {
        const professional = await tx.professional.create({
          data: {
            tenantId,
            userId,
            displayName:          dto.displayName,
            color:                dto.color,
            acceptsOnlineBooking: dto.acceptsOnlineBooking ?? true,
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        })

        const activeBranches = await tx.branch.findMany({
          where:  { tenantId, isActive: true },
          select: { id: true },
        })
        if (activeBranches.length > 0) {
          await tx.professionalBranch.createMany({
            data: activeBranches.map(b => ({
              professionalId: professional.id,
              branchId:       b.id,
            })),
            skipDuplicates: true,
          })
        }

        return professional
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Este usuario ya tiene un perfil profesional')
      }
      throw err
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Service linking
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Links a Service to a Professional (creates a ProfessionalService row).
   *
   * Both entities are validated against the same tenantId before linking,
   * preventing cross-tenant associations.
   *
   * Returns 409 if the link already exists (idempotent-friendly: callers can
   * catch 409 and treat it as success in setup scripts).
   */
  async addService(tenantId: string, professionalId: string, serviceId: string) {
    // Verify professional exists and belongs to this tenant
    const professional = await this.prisma.professional.findFirst({
      where:  { id: professionalId, tenantId },
      select: { id: true },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    // Verify service exists, is active, and belongs to this tenant
    const service = await this.prisma.service.findFirst({
      where:  { id: serviceId, tenantId, isActive: true },
      select: { id: true, name: true },
    })
    if (!service) throw new NotFoundException('Servicio no encontrado')

    // Check for existing link before inserting to give a clean error message
    const existing = await this.prisma.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    })
    if (existing) {
      throw new ConflictException('El servicio ya está vinculado a este profesional')
    }

    return this.prisma.professionalService.create({
      data: { professionalId, serviceId },
    })
  }

  /**
   * Removes the link between a Service and a Professional.
   * Does NOT delete appointments that used this combination.
   */
  async removeService(tenantId: string, professionalId: string, serviceId: string) {
    const professional = await this.prisma.professional.findFirst({
      where:  { id: professionalId, tenantId },
      select: { id: true },
    })
    if (!professional) throw new NotFoundException('Profesional no encontrado')

    const link = await this.prisma.professionalService.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    })
    if (!link) throw new NotFoundException('El servicio no está vinculado a este profesional')

    await this.prisma.professionalService.delete({
      where: { professionalId_serviceId: { professionalId, serviceId } },
    })
    return { deleted: true, professionalId, serviceId }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.professional.findMany({
      where:   { tenantId, isActive: true },
      include: {
        user:     { select: { id: true, firstName: true, lastName: true, email: true } },
        services: { include: { service: true } },
      },
    })
  }

  async findOne(tenantId: string, id: string) {
    const prof = await this.prisma.professional.findFirst({
      where:   { id, tenantId },
      include: {
        user:      true,
        services:  { include: { service: true } },
        schedules: true,
      },
    })
    if (!prof) throw new NotFoundException('Profesional no encontrado')
    return prof
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Soft delete
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Soft-delete a professional. We never hard-delete because Appointment
   * rows reference the professional and history must be preserved. The
   * dashboard listing and the public booking flow both filter by
   * `isActive: true`, so flipping this flag effectively removes the
   * professional from the product.
   *
   * Blocked when there's at least one future PENDING/CONFIRMED appointment:
   * removing the pro silently while clients have upcoming turnos would be a
   * footgun. The caller is told the count and can cancel/reschedule first.
   */
  async softDelete(tenantId: string, id: string) {
    const prof = await this.prisma.professional.findFirst({
      where:  { id, tenantId },
      select: { id: true, isActive: true },
    })
    if (!prof) throw new NotFoundException('Profesional no encontrado')
    if (!prof.isActive) {
      // Idempotent — nothing to do, just return success.
      return { id, deleted: true, alreadyInactive: true }
    }

    const now = new Date()
    const futureCount = await this.prisma.appointment.count({
      where: {
        tenantId,
        professionalId: id,
        startAt: { gte: now },
        status:  { in: ['PENDING', 'CONFIRMED'] },
      },
    })
    if (futureCount > 0) {
      throw new ConflictException(
        `El profesional tiene ${futureCount} turno${futureCount === 1 ? '' : 's'} futuro${futureCount === 1 ? '' : 's'}. Cancelalo${futureCount === 1 ? '' : 's'} antes de eliminar el profesional.`,
      )
    }

    await this.prisma.professional.update({
      where: { id },
      data:  { isActive: false },
    })
    return { id, deleted: true }
  }
}
