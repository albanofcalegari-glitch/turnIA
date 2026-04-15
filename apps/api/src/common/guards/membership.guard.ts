import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { SKIP_MEMBERSHIP_CHECK_KEY } from '../decorators/skip-membership-check.decorator'

const GRACE_PERIOD_DAYS = 7

/**
 * Enforces the tenant's membership status on every authenticated request.
 *
 * Registered as APP_GUARD so it runs before any controller/method guard. That
 * means we cannot rely on passport-jwt having populated `req.user` yet — we
 * decode the JWT ourselves. Unauthenticated and SuperAdmin calls fall through.
 *
 * Lifecycle:
 *   trial / paid        → full access
 *   grace period (7d)   → reads only (GET / HEAD / OPTIONS)
 *   suspended           → 403 across the board
 *
 * Opt-out: mark a route with @SkipMembershipCheck() — used on the subscribe
 * endpoints themselves (must work for expired tenants trying to pay up) and
 * on auth endpoints that never have a tenantId.
 */
@Injectable()
export class MembershipGuard implements CanActivate {
  private readonly logger = new Logger(MembershipGuard.name)

  constructor(
    private reflector: Reflector,
    private prisma:    PrismaService,
    private jwt:       JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MEMBERSHIP_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (skip) return true

    const req  = context.switchToHttp().getRequest()
    const auth = req.headers?.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      // No token → not our problem; JwtAuthGuard (if any) will handle it.
      return true
    }

    let payload: { sub?: string; tenantId?: string; isSuperAdmin?: boolean }
    try {
      payload = this.jwt.verify(auth.slice(7))
    } catch {
      // Invalid/expired token → let downstream auth guard produce the 401.
      return true
    }

    if (payload.isSuperAdmin) return true
    if (!payload.tenantId)    return true

    const tenant = await this.prisma.tenant.findUnique({
      where:  { id: payload.tenantId },
      select: { isActive: true, membershipExpiresAt: true },
    })
    if (!tenant) return true

    if (!tenant.isActive) {
      throw new ForbiddenException('TENANT_SUSPENDED')
    }

    const now    = new Date()
    const expiry = tenant.membershipExpiresAt
    if (!expiry) return true
    if (expiry > now) return true

    const graceEnd = new Date(expiry.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    if (now > graceEnd) {
      throw new ForbiddenException('TENANT_SUSPENDED')
    }

    const method = (req.method as string).toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true
    }
    throw new ForbiddenException('TENANT_READ_ONLY')
  }
}
