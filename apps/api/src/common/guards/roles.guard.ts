import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TenantRole } from '@turnia/shared'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * RolesGuard — resolves the caller's role for the current tenant from the DB.
 *
 * Why not read role from the JWT?
 *   The JWT is signed once at login and not refreshed on role changes.
 *   If an admin changes a user's role, the old JWT would still carry the
 *   stale role. Querying TenantUser on every protected request ensures
 *   role changes take effect immediately without requiring a re-login.
 *
 * Performance: the TenantUser lookup is a single PK query (userId_tenantId
 * is a unique compound index). Cost is negligible compared to the main
 * business query that follows.
 *
 * Must run AFTER JwtAuthGuard (req.user must be populated) and
 * AFTER TenantMiddleware (req.tenantId must be populated).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma:    PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])

    // No @Roles decorator → route is accessible to any authenticated user
    if (!requiredRoles?.length) return true

    const req = ctx.switchToHttp().getRequest()

    // SuperAdmins bypass all role checks
    if (req.user?.isSuperAdmin) return true

    const tenantId = req.tenantId as string | undefined
    const userId   = req.user?.sub  as string | undefined

    if (!tenantId || !userId) {
      throw new ForbiddenException('Permisos insuficientes')
    }

    // Single indexed PK lookup — resolves the live role for this tenant
    const membership = await this.prisma.tenantUser.findUnique({
      where:  { userId_tenantId: { userId, tenantId } },
      select: { role: true },
    })

    if (!membership || !requiredRoles.includes(membership.role as TenantRole)) {
      throw new ForbiddenException('Permisos insuficientes')
    }

    return true
  }
}
