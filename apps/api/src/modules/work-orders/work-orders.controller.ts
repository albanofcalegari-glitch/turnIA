import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { WorkOrdersService } from './work-orders.service'
import { CreateWorkOrderDto } from './dto/create-work-order.dto'
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto'
import { AssignProfessionalDto } from './dto/assign-professional.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { TenantRole } from '@turnia/shared'

/**
 * Work Orders — Phase 1 (admin-only, manual assignment).
 *
 * All endpoints require JWT + ADMIN role. No public/guest access.
 */
@Controller('work-orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(TenantRole.ADMIN)
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@TenantId() tenantId: string, @Body() dto: CreateWorkOrderDto) {
    return this.workOrders.create(tenantId, dto)
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.workOrders.findAll(tenantId, { status, branchId, from, to })
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.workOrders.findOne(tenantId, id)
  }

  // ── Status transitions ──────────────────────────────────────────────────

  @Patch(':id/status')
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ) {
    return this.workOrders.updateStatus(tenantId, id, dto.status)
  }

  // ── Staff assignment ────────────────────────────────────────────────────

  /**
   * GET /work-orders/:id/slots/:slotId/available-professionals
   * Returns professionals available (no conflict) for a given slot.
   */
  @Get(':id/slots/:slotId/available-professionals')
  getAvailableProfessionals(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('slotId') slotId: string,
  ) {
    return this.workOrders.getAvailableProfessionals(tenantId, id, slotId)
  }

  @Post(':id/slots/:slotId/assign')
  @HttpCode(HttpStatus.CREATED)
  assignProfessional(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @Body() dto: AssignProfessionalDto,
  ) {
    return this.workOrders.assignProfessional(tenantId, id, slotId, dto.professionalId)
  }

  @Delete(':id/slots/:slotId/assign/:professionalId')
  unassignProfessional(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('slotId') slotId: string,
    @Param('professionalId') professionalId: string,
  ) {
    return this.workOrders.unassignProfessional(tenantId, id, slotId, professionalId)
  }
}
