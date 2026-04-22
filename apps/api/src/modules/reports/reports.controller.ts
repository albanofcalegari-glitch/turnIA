import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { PrismaService } from '../../prisma/prisma.service'

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('monthly')
  async monthly(
    @TenantId() tenantId: string,
    @Query('months') monthsRaw?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    })
    if (tenant?.plan === 'standard') {
      throw new ForbiddenException('Los reportes están disponibles en el plan Pro')
    }
    const months = monthsRaw ? Math.min(24, Math.max(1, parseInt(monthsRaw, 10) || 6)) : 6
    return this.reports.getMonthly(tenantId, months)
  }
}
