import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload } from '@turnia/shared'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Ese email ya está registrado')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        email:        dto.email,
        passwordHash,
        firstName:    dto.firstName,
        lastName:     dto.lastName,
        phone:        dto.phone,
      },
    })

    return this.signToken(user)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw new UnauthorizedException('Credenciales inválidas')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Credenciales inválidas')

    if (!user.isActive) throw new UnauthorizedException('Cuenta deshabilitada')

    return this.signToken(user)
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: {
        tenants: {
          include: {
            tenant: {
              select: {
                id:                  true,
                slug:                true,
                name:                true,
                type:                true,
                timezone:            true,
                isActive:            true,
                membershipExpiresAt: true,
                // Stage 1 (branches): the dashboard uses this flag to decide
                // whether to show the Sucursales nav item and the per-page
                // branch selector. Single-branch tenants leave it false and
                // never see any branch UI.
                hasMultipleBranches: true,
              },
            },
          },
        },
      },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    // Phase 1 (work-orders): flag tenants that have at least one "complex"
    // service (multi-pro or multi-day). Used by the dashboard to conditionally
    // render the WorkOrders nav entry. Single query with distinct tenantIds,
    // avoids N+1 when a user belongs to multiple tenants.
    const tenantIds = user.tenants.map(t => t.tenantId)
    const complexRows = tenantIds.length > 0
      ? await this.prisma.service.findMany({
          where: {
            tenantId: { in: tenantIds },
            isActive: true,
            OR: [
              { minProfessionals: { gt: 1 } },
              { allowsMultiDay:    true       },
            ],
          },
          select:   { tenantId: true },
          distinct: ['tenantId'],
        })
      : []
    const complexSet = new Set(complexRows.map(r => r.tenantId))

    return {
      id:          user.id,
      email:       user.email,
      firstName:   user.firstName,
      lastName:    user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      tenants: user.tenants.map(t => ({
        tenantId: t.tenantId,
        role:     t.role,
        tenant: {
          ...t.tenant,
          hasComplexServices: complexSet.has(t.tenantId),
        },
      })),
    }
  }

  private signToken(user: { id: string; email: string; isSuperAdmin: boolean }) {
    const payload: JwtPayload = {
      sub:          user.id,
      email:        user.email,
      isSuperAdmin: user.isSuperAdmin,
    }
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id:          user.id,
        email:       user.email,
        isSuperAdmin: user.isSuperAdmin,
      },
    }
  }
}
