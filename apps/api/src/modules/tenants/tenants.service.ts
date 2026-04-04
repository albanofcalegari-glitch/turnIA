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
          scheduleRules: { create: {} },
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
    const tenant = await this.prisma.tenant.findUnique({
      where:   { slug, isActive: true },
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
}
