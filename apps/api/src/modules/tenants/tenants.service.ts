import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTenantDto } from './dto/create-tenant.dto'

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } })
    if (slugExists) throw new ConflictException('Ese identificador ya está en uso')

    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } })
    if (emailExists) throw new ConflictException('Ese email ya está registrado')

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12)

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:     dto.name,
          slug:     dto.slug,
          type:     dto.type,
          timezone: dto.timezone ?? 'America/Argentina/Buenos_Aires',
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
        },
      })

      await tx.tenantUser.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
      })

      return { tenant, adminUserId: user.id }
    })
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
}
