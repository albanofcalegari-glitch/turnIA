import {
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { AppointmentItemDto } from './create-appointment.dto'

export class RescheduleAppointmentDto {
  /**
   * New start time in ISO 8601 UTC.
   * Subject to the same minAdvance / bookingWindow constraints as a fresh booking.
   */
  @IsDateString()
  startAt!: string

  /**
   * Override the branch (sucursal) for the rescheduled appointment.
   * When omitted the original appointment's branch is kept.
   * Useful when a multi-branch professional moves a booking to a
   * different sucursal as part of the reschedule.
   */
  @IsOptional()
  @IsString()
  branchId?: string

  /**
   * Override the professional for the rescheduled appointment.
   * When omitted the original professional is kept.
   */
  @IsOptional()
  @IsString()
  professionalId?: string

  /**
   * Override the service list for the rescheduled appointment.
   * When omitted the original services (in their original order) are kept.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AppointmentItemDto)
  items?: AppointmentItemDto[]
}
