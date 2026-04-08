import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { BranchesService } from './branches.service'
import { CreateBranchDto } from './dto/create-branch.dto'
import { UpdateBranchDto } from './dto/update-branch.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { TenantRole } from '@turnia/shared'

@Controller('branches')
@UseGuards(TenantGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  // ── Public read (no JWT) — used by the booking flow ──────────────────────

  /**
   * Returns active branches for the current tenant.
   * Sends X-Tenant-ID like the rest of the public booking endpoints.
   */
  @Get()
  list(@TenantId() tenantId: string) {
    return this.branchesService.findActiveByTenant(tenantId)
  }

  // ── Admin read ────────────────────────────────────────────────────────────

  /**
   * Returns every branch (active and inactive) — for the admin dashboard.
   * Separated from `list()` so the public endpoint never leaks inactive
   * branches or admin-only fields.
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  listAll(@TenantId() tenantId: string) {
    return this.branchesService.findAllByTenant(tenantId)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.branchesService.findOne(tenantId, id)
  }

  // ── Admin write ───────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  create(@TenantId() tenantId: string, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(tenantId, dto)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(tenantId, id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.branchesService.remove(tenantId, id)
  }
}
