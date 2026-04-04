import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  IsEmail,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'

/**
 * A single service line within the appointment.
 * Order is determined by the array index, not a separate field.
 */
export class AppointmentItemDto {
  @IsString()
  serviceId!: string
}

export class CreateAppointmentDto {
  /** Professional to book with (must belong to the same tenant). */
  @IsString()
  professionalId!: string

  /**
   * Requested start time in ISO 8601 UTC.
   * Example: "2026-04-15T13:00:00.000Z"
   */
  @IsDateString()
  startAt!: string

  /**
   * Services to perform, in the desired sequence.
   * Duration, pricing, and buffers are resolved server-side from the
   * professional's configuration — the client only sends service IDs.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AppointmentItemDto)
  items!: AppointmentItemDto[]

  /** Optional note from the client visible to the professional. */
  @IsOptional()
  @IsString()
  notes?: string

  // ── Guest fields (required when booking without an account) ──────────────

  @IsOptional()
  @IsString()
  guestName?: string

  @IsOptional()
  @IsEmail()
  guestEmail?: string

  @IsOptional()
  @IsString()
  guestPhone?: string
}
