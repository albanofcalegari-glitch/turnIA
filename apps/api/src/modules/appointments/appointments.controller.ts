import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { JwtPayload } from '@turnia/shared'

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Create a new appointment.
   *
   * Open to both authenticated users and guests:
   * - Authenticated: JWT is read, clientId = user.sub
   * - Guest: no JWT (or invalid token), clientId = null;
   *   guestName + guestEmail are required in the body.
   *
   * The TenantGuard still runs — the request must include the tenant slug
   * via subdomain or X-Tenant-Slug header.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalJwtAuthGuard, TenantGuard)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload | null,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(tenantId, user?.sub ?? null, dto)
  }

  /**
   * GET /appointments/guest?email=xxx
   * Public — returns active future appointments for a guest email.
   */
  @Get('guest')
  @UseGuards(TenantGuard)
  findByGuestEmail(
    @TenantId() tenantId: string,
    @Query('email') email: string,
  ) {
    return this.appointmentsService.findByGuestEmail(tenantId, email)
  }

  /**
   * PATCH /appointments/:id/guest-cancel
   * Public — cancels an appointment after verifying the guest email.
   */
  @Patch(':id/guest-cancel')
  @UseGuards(TenantGuard)
  guestCancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('email') email: string,
    @Body('reason') reason?: string,
  ) {
    return this.appointmentsService.guestCancel(tenantId, id, email, reason)
  }

  // ── Routes below require authentication ────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  findAll(
    @TenantId() tenantId: string,
    @Query('professionalId') professionalId?: string,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.appointmentsService.findAll(tenantId, { professionalId, branchId, date, from, to })
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointmentsService.findOne(tenantId, id)
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, TenantGuard)
  confirm(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointmentsService.confirm(tenantId, id)
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, TenantGuard)
  complete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointmentsService.complete(tenantId, id)
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, TenantGuard)
  cancel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.appointmentsService.cancel(tenantId, id, user.sub, reason)
  }

  @Patch(':id/no-show')
  @UseGuards(JwtAuthGuard, TenantGuard)
  noShow(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.appointmentsService.noShow(tenantId, id)
  }

  /**
   * PATCH /api/v1/appointments/:id/reschedule
   *
   * Moves an existing appointment to a new time slot.
   * The original appointment is marked RESCHEDULED; a new appointment is
   * created and returned. Both mutations occur in one SERIALIZABLE transaction.
   *
   * Requires authentication. The client (guest snapshots) is carried forward
   * from the original — no re-identification needed.
   */
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard, TenantGuard)
  reschedule(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(tenantId, id, dto)
  }
}
