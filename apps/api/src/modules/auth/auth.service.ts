import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { JwtPayload } from '@turnia/shared'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private mail:    MailService,
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
                plan:                true,
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
      emailVerifiedAt: user.emailVerifiedAt,
      tenants: user.tenants.map(t => ({
        tenantId: t.tenantId,
        role:     t.role,
        tenant:   t.tenant,
      })),
    }
  }

  /**
   * Genera un token de reseteo y se lo envía por email al usuario.
   * Responde siempre OK — no revelamos si el email existe o no, para evitar
   * que sirva como enumeration oracle.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) return

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h

    await this.prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordResetToken:     token,
        passwordResetExpiresAt: expiresAt,
      },
    })

    await this.mail.sendPasswordResetEmail({
      to:         user.email,
      firstName:  user.firstName,
      resetToken: token,
    })
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { passwordResetToken: token } })
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Link inválido o expirado')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await this.prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordHash,
        passwordResetToken:     null,
        passwordResetExpiresAt: null,
      },
    })
  }

  /**
   * Reenvía el email de verificación. Si el usuario ya está verificado no hace
   * nada. Idempotente desde el punto de vista del cliente — responde OK siempre.
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { tenants: { include: { tenant: { select: { name: true } } } } },
    })
    if (!user || user.emailVerifiedAt) return

    let token = user.emailVerificationToken
    if (!token) {
      token = randomBytes(32).toString('hex')
      await this.prisma.user.update({
        where: { id: user.id },
        data:  { emailVerificationToken: token },
      })
    }

    const tenantName = user.tenants[0]?.tenant.name ?? 'turnIT'
    await this.mail.sendWelcomeEmail({
      to:           user.email,
      firstName:    user.firstName,
      tenantName,
      verifyToken:  token,
    })
  }

  /**
   * Verifica el email a partir del token. Idempotente — si ya estaba verificado
   * lo dejamos pasar para que el link del mail no rompa si el usuario lo abre dos veces.
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { emailVerificationToken: token } })
    if (!user) throw new BadRequestException('Link de verificación inválido')

    if (user.emailVerifiedAt) return

    await this.prisma.user.update({
      where: { id: user.id },
      data:  {
        emailVerifiedAt:        new Date(),
        emailVerificationToken: null,
      },
    })
  }

  async requestEmailOtp(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { tenants: { select: { tenantId: true, tenant: { select: { name: true } } } } },
    })
    if (!user || user.emailVerifiedAt) return { sent: true }

    const tenantId   = user.tenants[0]?.tenantId ?? 'system'
    const tenantName = user.tenants[0]?.tenant.name ?? 'turnIT'

    const recent = await this.prisma.otpCode.findFirst({
      where: {
        tenantId,
        email:     user.email,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    })
    if (recent) return { sent: true }

    await this.prisma.otpCode.deleteMany({ where: { tenantId, email: user.email } })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await this.prisma.otpCode.create({
      data: {
        tenantId,
        email:     user.email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    await this.mail.sendOtpCode({ to: user.email, code, tenantName })
    return { sent: true }
  }

  async verifyEmailOtp(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true, tenants: { select: { tenantId: true } } },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    if (user.emailVerifiedAt) return

    const tenantId = user.tenants[0]?.tenantId ?? 'system'

    const otp = await this.prisma.otpCode.findFirst({
      where: { tenantId, email: user.email, expiresAt: { gte: new Date() } },
    })

    if (!otp) throw new BadRequestException('Código expirado o inválido. Solicitá uno nuevo.')

    if (otp.attempts >= 5) {
      await this.prisma.otpCode.delete({ where: { id: otp.id } })
      throw new BadRequestException('Demasiados intentos. Solicitá un nuevo código.')
    }

    if (otp.code !== code) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      throw new BadRequestException('Código incorrecto. Intentá de nuevo.')
    }

    await this.prisma.otpCode.delete({ where: { id: otp.id } })
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { emailVerifiedAt: new Date(), emailVerificationToken: null },
    })
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
