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

    return await this.signToken(user)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw new UnauthorizedException('Credenciales inválidas')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Credenciales inválidas')

    if (!user.isActive) throw new UnauthorizedException('Cuenta deshabilitada')

    return await this.signToken(user)
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

    return {
      id:          user.id,
      email:       user.email,
      firstName:   user.firstName,
      lastName:    user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      tenants: user.tenants.map(t => ({
        tenantId: t.tenantId,
        role:     t.role,
        tenant:   t.tenant,
      })),
    }
  }

  private async signToken(user: { id: string; email: string; isSuperAdmin: boolean }) {
    // Look up the user's first tenant membership so the JWT carries tenantId
    // and role — required by guards like RolesGuard and endpoints that check
    // user.tenantId (e.g. schedule-rules).
    const membership = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id },
    })

    const payload: JwtPayload = {
      sub:          user.id,
      email:        user.email,
      isSuperAdmin: user.isSuperAdmin,
      ...(membership && {
        tenantId: membership.tenantId,
        role:     membership.role as JwtPayload['role'],
      }),
    }
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id:           user.id,
        email:        user.email,
        isSuperAdmin: user.isSuperAdmin,
      },
    }
  }
}
