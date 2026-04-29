import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { TenantId } from '../../common/decorators/tenant.decorator'

@Controller('clients')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get('search')
  search(
    @TenantId() tenantId: string,
    @Query('q') q: string,
  ) {
    return this.clients.search(tenantId, q ?? '')
  }
}
