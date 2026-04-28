import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { CreateTenantDto } from './dto/create-tenant.dto'

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name)

  constructor(
    private prisma: PrismaService,
    private mail:   MailService,
  ) {}

  async create(dto: CreateTenantDto) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } })
    if (slugExists) throw new ConflictException('Ese identificador ya está en uso')

    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } })
    if (emailExists) throw new ConflictException('Ese email ya está registrado')

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12)
    const verifyToken  = randomBytes(32).toString('hex')

    // 45-day free trial. After that the tenant must subscribe via Mercado Pago
    // or the scheduled deactivation job + read-only guard will take over.
    const trialEndsAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:     dto.name,
          slug:     dto.slug,
          type:     dto.type,
          timezone: dto.timezone ?? 'America/Argentina/Buenos_Aires',
          plan:                'trial',
          membershipExpiresAt: trialEndsAt,
          // Stage 1 (branches): the owner declares this at registration. The
          // flag drives whether the dashboard exposes the branch UI; the
          // default branch row below exists either way so branchId FKs on
          // appointments / work_schedules / resources stay satisfiable.
          hasMultipleBranches: dto.hasMultipleBranches ?? false,
          scheduleRules: { create: {} },
          branches: {
            create: {
              name:      dto.defaultBranchName?.trim() || 'Sucursal principal',
              slug:      'principal',
              address:   null,
              phone:     null,
              isDefault: true,
              isActive:  true,
              order:     0,
            },
          },
        },
      })

      const user = await tx.user.create({
        data: {
          email:        dto.adminEmail,
          passwordHash,
          firstName:    dto.adminFirstName,
          lastName:     dto.adminLastName,
          emailVerificationToken: verifyToken,
        },
      })

      await tx.tenantUser.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
      })

      return { tenant, adminUserId: user.id }
    })

    // El mail se envía fuera de la transacción para no retenerla si Resend
    // tarda o falla. Si el envío falla logueamos pero no rompemos el registro.
    this.mail.sendWelcomeEmail({
      to:          dto.adminEmail,
      firstName:   dto.adminFirstName,
      tenantName:  result.tenant.name,
      verifyToken,
    }).catch((err) => this.logger.warn(`No se pudo enviar welcome email: ${err?.message ?? err}`))

    return result
  }

  async findBySlug(slug: string) {
    // Note: we DO NOT filter by isActive here. The frontend needs to
    // distinguish between "tenant doesn't exist" (404) and "tenant exists but
    // membership is suspended" so it can show a meaningful message instead of
    // a generic not-found. The `isActive` field is included in the response.
    const tenant = await this.prisma.tenant.findUnique({
      where:   { slug },
      include: { scheduleRules: true },
    })
    if (!tenant) throw new NotFoundException('Negocio no encontrado')
    return tenant
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, isActive: true },
    })
    if (!tenant) throw new NotFoundException('Negocio no encontrado')
    return tenant
  }

  /**
   * Patch a subset of the tenant's `schedule_rules`. Only fields the dashboard
   * UI exposes are accepted by the controller's DTO. The schedule_rules row
   * is created on tenant registration so we can use a simple update().
   */
  async updateScheduleRules(tenantId: string, data: { slotDurationMinutes?: number }) {
    const updated = await this.prisma.scheduleRule.update({
      where: { tenantId },
      data,
    })
    return updated
  }

  // ── SuperAdmin methods ──────────────────────────────────────────────────

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { appointments: true, professionals: true, services: true } },
      },
    })
  }

  async updateTenant(id: string, data: {
    isActive?: boolean
    plan?: string
    membershipExpiresAt?: Date | null
  }) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    })
  }

  async deactivateExpired() {
    const now = new Date()
    const result = await this.prisma.tenant.updateMany({
      where: {
        isActive: true,
        membershipExpiresAt: { not: null, lt: now },
      },
      data: { isActive: false },
    })
    return { deactivated: result.count }
  }

  async adminStats() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      appointments,
      appointmentsThisMonth,
      appointmentsLastMonth,
      byStatus,
      recentTenants,
      topTenants,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenant.count({ where: { plan: 'trial', isActive: true } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, plan: true, createdAt: true, isActive: true },
      }),
      this.prisma.tenant.findMany({
        where: { isActive: true },
        orderBy: { appointments: { _count: 'desc' } },
        take: 10,
        select: {
          id: true, name: true, slug: true, plan: true,
          _count: { select: { appointments: true, professionals: true, services: true } },
        },
      }),
    ])

    const statusMap: Record<string, number> = {}
    for (const s of byStatus) statusMap[s.status] = s._count

    const last6Months: { month: string; tenants: number; appointments: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = start.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })

      const [tCount, aCount] = await Promise.all([
        this.prisma.tenant.count({ where: { createdAt: { lt: end } } }),
        this.prisma.appointment.count({ where: { createdAt: { gte: start, lt: end } } }),
      ])
      last6Months.push({ month: label, tenants: tCount, appointments: aCount })
    }

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const emailsSentThisMonth = await this.prisma.emailLog.count({
      where: { sentAt: { gte: startOfMonth } },
    })

    return {
      totalTenants,
      activeTenants,
      inactiveTenants: totalTenants - activeTenants,
      trialTenants,
      totalAppointments: appointments,
      appointmentsThisMonth,
      appointmentsLastMonth,
      appointmentsByStatus: statusMap,
      recentTenants,
      topTenants,
      evolution: last6Months,
      emailsSentThisMonth,
      emailMonthlyLimit: 3000,
      emailResetsAt: nextMonth.toISOString(),
    }
  }
}
