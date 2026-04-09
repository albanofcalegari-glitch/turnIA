import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ProfessionalsService } from './professionals.service'
import { CreateProfessionalDto } from './dto/create-professional.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { TenantRole } from '@turnia/shared'
import { JwtPayload } from '@turnia/shared'

/**
 * Professionals controller.
 *
 * Read endpoints are public (no JWT) to support the guest booking flow —
 * a visitor must be able to browse professionals before choosing one.
 *
 * Write endpoints require authentication:
 *   - POST /professionals          → ADMIN only (create a new professional)
 *   - POST /professionals/:id/services  → ADMIN only (link a service)
 *   - DELETE /professionals/:id/services/:serviceId → ADMIN only (unlink)
 */
@Controller('professionals')
@UseGuards(TenantGuard)
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  // ── Public read endpoints ─────────────────────────────────────────────────

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.professionalsService.findAll(tenantId)
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.professionalsService.findOne(tenantId, id)
  }

  // ── Admin write endpoints ─────────────────────────────────────────────────

  /**
   * POST /api/v1/professionals
   *
   * Creates a new Professional within the tenant.
   * Required headers: Authorization: Bearer <token>, X-Tenant-ID: <tenantId>
   *
   * If dto.userId is omitted, the professional is linked to the caller's account.
   * This supports the common case where the admin is also the only professional.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId()    tenantId: string,
    @CurrentUser() caller:   JwtPayload,
    @Body()        dto:      CreateProfessionalDto,
  ) {
    return this.professionalsService.create(tenantId, caller.sub, dto)
  }

  /**
   * POST /api/v1/professionals/:id/services
   *
   * Links a service to a professional.
   * Both must belong to the same tenant — validated server-side.
   * Body: { "serviceId": "<id>" }
   */
  @Post(':id/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  addService(
    @TenantId()          tenantId:       string,
    @Param('id')         professionalId: string,
    @Body('serviceId')   serviceId:      string,
  ) {
    return this.professionalsService.addService(tenantId, professionalId, serviceId)
  }

  /**
   * DELETE /api/v1/professionals/:id/services/:serviceId
   *
   * Unlinks a service from a professional.
   * Does NOT affect existing appointments.
   */
  @Delete(':id/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  removeService(
    @TenantId()              tenantId:       string,
    @Param('id')             professionalId: string,
    @Param('serviceId')      serviceId:      string,
  ) {
    return this.professionalsService.removeService(tenantId, professionalId, serviceId)
  }

  /**
   * DELETE /api/v1/professionals/:id
   *
   * Soft-deletes a professional (sets `isActive=false`). Blocked with 409
   * when the professional has PENDING/CONFIRMED future appointments — the
   * caller must cancel or reassign those first.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  remove(
    @TenantId()  tenantId: string,
    @Param('id') id:       string,
  ) {
    return this.professionalsService.softDelete(tenantId, id)
  }
}
