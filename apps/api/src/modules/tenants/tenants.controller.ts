import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common'
import { TenantsService } from './tenants.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtPayload } from '@turnia/shared'

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
}
