import { Controller, Post, Get, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { SkipMembershipCheck } from '../../common/decorators/skip-membership-check.decorator'
import { JwtPayload, TenantRole, type PlanTier } from '@turnia/shared'
import { SubscriptionsService } from './subscriptions.service'

// All routes in this controller are exempt from the global MembershipGuard:
// an expired tenant MUST be able to subscribe/cancel/inspect its own state,
// otherwise there is no path to reactivation.
@SkipMembershipCheck()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}

  /**
   * Start (or resume) the subscription flow. Returns the MP init_point URL
   * the frontend redirects to. Only the tenant admin can subscribe — we
   * don't want employees accidentally signing the business up.
   */
  @Post('me')
  @UseGuards(JwtAuthGuard)
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body('tier') tier?: Exclude<PlanTier, 'trial'>,
  ) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede contratar la suscripción')
    }
    return this.subscriptions.subscribe(user.tenantId, tier || 'standard')
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    return this.subscriptions.getMySubscription(user.tenantId)
  }

  @Post('me/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede cancelar la suscripción')
    }
    return this.subscriptions.cancel(user.tenantId)
  }

  // ── SuperAdmin ──────────────────────────────────────────────────────────

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard)
  adminPayments(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('status')   status?: string,
    @Query('from')     from?: string,
    @Query('to')       to?: string,
  ) {
    if (!user.isSuperAdmin) throw new ForbiddenException()
    return this.subscriptions.adminListPayments({
      tenantId,
      status,
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
    })
  }

  @Get('admin/metrics')
  @UseGuards(JwtAuthGuard)
  adminMetrics(@CurrentUser() user: JwtPayload) {
    if (!user.isSuperAdmin) throw new ForbiddenException()
    return this.subscriptions.adminMetrics()
  }
}
