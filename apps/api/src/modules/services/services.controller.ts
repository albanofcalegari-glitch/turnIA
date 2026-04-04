import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ServicesService } from './services.service'
import { CreateServiceDto } from './dto/create-service.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { TenantRole } from '@turnia/shared'

@Controller('services')
@UseGuards(TenantGuard)
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  // ── Public read endpoints (no JWT — required for guest booking flow) ──────

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.servicesService.findAll(tenantId)
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.servicesService.findOne(tenantId, id)
  }

  // ── Admin-only write endpoints ─────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  create(@TenantId() tenantId: string, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(tenantId, dto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: Partial<CreateServiceDto>) {
    return this.servicesService.update(tenantId, id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(TenantRole.ADMIN)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.servicesService.remove(tenantId, id)
  }
}
