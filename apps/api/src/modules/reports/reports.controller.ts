import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { TenantId } from '../../common/decorators/tenant.decorator'

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('monthly')
  monthly(
    @TenantId() tenantId: string,
    @Query('months') monthsRaw?: string,
  ) {
    const months = monthsRaw ? Math.min(24, Math.max(1, parseInt(monthsRaw, 10) || 6)) : 6
    return this.reports.getMonthly(tenantId, months)
  }
}
