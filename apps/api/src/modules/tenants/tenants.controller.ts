import { Controller, Post, Get, Patch, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common'
import { TenantsService } from './tenants.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto, UpdateScheduleRulesDto } from './dto/update-tenant.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtPayload, TenantRole } from '@turnia/shared'

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post('register')
  register(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto)
  }

  @Get(':slug/public')
  getPublic(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyTenant(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) return null
    return this.tenantsService.findById(user.tenantId)
  }

  /**
   * Tenant admins can patch their own schedule rules. Currently the dashboard
   * only exposes `slotDurationMinutes`. Scoped via JWT — there is no path
   * param tenantId on purpose so callers can't reach into another tenant.
   */
  @Patch('me/schedule-rules')
  @UseGuards(JwtAuthGuard)
  async updateMyScheduleRules(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateScheduleRulesDto,
  ) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN) {
      throw new ForbiddenException('Solo administradores pueden cambiar la configuración')
    }
    return this.tenantsService.updateScheduleRules(user.tenantId, {
      slotDurationMinutes: dto.slotDurationMinutes,
    })
  }

  // ── SuperAdmin endpoints ────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  async listAll(@CurrentUser() user: JwtPayload) {
    if (!user.isSuperAdmin) throw new ForbiddenException()
    return this.tenantsService.findAll()
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard)
  async updateTenant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    if (!user.isSuperAdmin) throw new ForbiddenException()
    return this.tenantsService.updateTenant(id, {
      isActive: dto.isActive,
      plan: dto.plan,
      membershipExpiresAt: dto.membershipExpiresAt ? new Date(dto.membershipExpiresAt) : dto.membershipExpiresAt === null ? null : undefined,
    })
  }

  @Post('admin/deactivate-expired')
  @UseGuards(JwtAuthGuard)
  async deactivateExpired(@CurrentUser() user: JwtPayload) {
    if (!user.isSuperAdmin) throw new ForbiddenException()
    return this.tenantsService.deactivateExpired()
  }
}
