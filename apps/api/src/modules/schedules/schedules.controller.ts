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
import { SchedulesService } from './schedules.service'
import { GetSlotsDto } from './dto/get-slots.dto'
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto'
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto'
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto'
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { JwtPayload } from '@turnia/shared'

/**
 * Schedules controller — manages work schedules and exceptions per professional.
 *
 * Route structure:
 *   /schedules/:professionalId/slots              — public (guest booking)
 *   /schedules/:professionalId/work-schedule      — protected (admin or self)
 *   /schedules/:professionalId/work-schedule/:id  — protected (admin or self)
 *   /schedules/:professionalId/exceptions         — protected (admin or self)
 *   /schedules/:professionalId/exceptions/:id     — protected (admin or self)
 *
 * Permission model:
 *   Read endpoints: any authenticated user in the tenant
 *   Write endpoints: tenant ADMIN or the professional themselves
 */
@Controller('schedules')
@UseGuards(TenantGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Slots — public
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /schedules/:professionalId/slots?date=YYYY-MM-DD&serviceIds=id1,id2
   *
   * Public — no JWT required. Supports the guest booking flow.
   * Returns all available start times for the given professional, date, and services.
   */
  @Get(':professionalId/slots')
  getAvailableSlots(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @Query()                 query:          GetSlotsDto,
  ) {
    return this.schedulesService.getAvailableSlots(
      tenantId,
      professionalId,
      query.date,
      query.serviceIds,
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WorkSchedule — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /schedules/:professionalId/work-schedule
   * Returns the active recurring weekly schedule for a professional.
   */
  @Get(':professionalId/work-schedule')
  @UseGuards(JwtAuthGuard)
  getWorkSchedule(@Param('professionalId') professionalId: string) {
    return this.schedulesService.getWorkSchedule(professionalId)
  }

  /**
   * POST /schedules/:professionalId/work-schedule
   * Creates a new work-schedule entry for a specific day of week.
   * Returns 409 if that day already has an entry — use PATCH to update it.
   */
  @Post(':professionalId/work-schedule')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createWorkSchedule(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @CurrentUser()           caller:         JwtPayload,
    @Body()                  dto:            CreateWorkScheduleDto,
  ) {
    return this.schedulesService.createWorkSchedule(tenantId, professionalId, caller, dto)
  }

  /**
   * PATCH /schedules/:professionalId/work-schedule/:id
   * Updates the times or active state of an existing entry.
   * To change the day of week, delete this entry and create a new one.
   */
  @Patch(':professionalId/work-schedule/:id')
  @UseGuards(JwtAuthGuard)
  updateWorkSchedule(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @Param('id')             id:             string,
    @CurrentUser()           caller:         JwtPayload,
    @Body()                  dto:            UpdateWorkScheduleDto,
  ) {
    return this.schedulesService.updateWorkSchedule(tenantId, professionalId, id, caller, dto)
  }

  /**
   * DELETE /schedules/:professionalId/work-schedule/:id
   * Removes a work-schedule entry.
   * Does NOT cancel existing appointments — verify impact before deleting.
   * Returns: { deleted: true, id }
   */
  @Delete(':professionalId/work-schedule/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deleteWorkSchedule(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @Param('id')             id:             string,
    @CurrentUser()           caller:         JwtPayload,
  ) {
    return this.schedulesService.deleteWorkSchedule(tenantId, professionalId, id, caller)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ScheduleException — CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /schedules/:professionalId/exceptions?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Returns all exceptions in the given date range.
   */
  @Get(':professionalId/exceptions')
  @UseGuards(JwtAuthGuard)
  getExceptions(
    @Param('professionalId') professionalId: string,
    @Query('from')           from:           string,
    @Query('to')             to:             string,
  ) {
    return this.schedulesService.getExceptions(
      professionalId,
      new Date(from),
      new Date(to),
    )
  }

  /**
   * POST /schedules/:professionalId/exceptions
   * Creates a block, vacation, holiday, or custom-hours exception.
   *
   * Multiple exceptions per day are allowed (e.g. two partial blocks).
   * The availability engine processes all of them when computing free slots.
   */
  @Post(':professionalId/exceptions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createException(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @CurrentUser()           caller:         JwtPayload,
    @Body()                  dto:            CreateScheduleExceptionDto,
  ) {
    return this.schedulesService.createException(tenantId, professionalId, caller, dto)
  }

  /**
   * PATCH /schedules/:professionalId/exceptions/:id
   * Updates type, times, or reason of an existing exception.
   * date is intentionally excluded — to change the date, delete and recreate.
   */
  @Patch(':professionalId/exceptions/:id')
  @UseGuards(JwtAuthGuard)
  updateException(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @Param('id')             id:             string,
    @CurrentUser()           caller:         JwtPayload,
    @Body()                  dto:            UpdateScheduleExceptionDto,
  ) {
    return this.schedulesService.updateException(tenantId, professionalId, id, caller, dto)
  }

  /**
   * DELETE /schedules/:professionalId/exceptions/:id
   * Removes an exception, restoring normal availability for that date.
   * Returns: { deleted: true, id }
   */
  @Delete(':professionalId/exceptions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deleteException(
    @TenantId()              tenantId:       string,
    @Param('professionalId') professionalId: string,
    @Param('id')             id:             string,
    @CurrentUser()           caller:         JwtPayload,
  ) {
    return this.schedulesService.deleteException(tenantId, professionalId, id, caller)
  }
}
