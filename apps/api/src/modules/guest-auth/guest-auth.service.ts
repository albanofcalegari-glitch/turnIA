import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { MailService } from '../mail/mail.service'

const OTP_TTL_MS      = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS    = 5
const RATE_LIMIT_MS   = 60 * 1000       // 1 code per email per minute

@Injectable()
export class GuestAuthService {
  private readonly logger = new Logger(GuestAuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt:    JwtService,
    private readonly mail:   MailService,
  ) {}

  async requestOtp(tenantId: string, email: string): Promise<{ sent: boolean }> {
    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit: no more than 1 code per email per minute
    const recent = await this.prisma.otpCode.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_MS) },
      },
    })
    if (recent) {
      return { sent: true } // silently succeed to avoid timing leaks
    }

    // Clean up old codes for this email+tenant
    await this.prisma.otpCode.deleteMany({
      where: { tenantId, email: normalizedEmail },
    })

    const code = String(Math.floor(100000 + Math.random() * 900000))

    await this.prisma.otpCode.create({
      data: {
        tenantId,
        email: normalizedEmail,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    })

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    })

    const sent = await this.mail.sendOtpCode({
      to:         normalizedEmail,
      code,
      tenantName: tenant?.name ?? 'turnIT',
    })

    if (!sent) {
      this.logger.warn(`OTP email failed for ${normalizedEmail} — client will skip verification`)
    }

    return { sent }
  }

  async verifyOtp(
    tenantId: string,
    email:    string,
    code:     string,
  ): Promise<{ valid: boolean; token?: string }> {
    const normalizedEmail = email.toLowerCase().trim()

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        expiresAt: { gte: new Date() },
      },
    })

    if (!otp) {
      throw new BadRequestException('Código expirado o inválido. Solicitá uno nuevo.')
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await this.prisma.otpCode.delete({ where: { id: otp.id } })
      throw new BadRequestException('Demasiados intentos. Solicitá un nuevo código.')
    }

    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      })
      throw new BadRequestException('Código incorrecto. Intentá de nuevo.')
    }

    // Valid — delete the OTP and issue a guest JWT
    await this.prisma.otpCode.delete({ where: { id: otp.id } })

    const token = this.jwt.sign(
      { email: normalizedEmail, tenantId, type: 'guest' },
      { expiresIn: '2h' },
    )

    return { valid: true, token }
  }
}
