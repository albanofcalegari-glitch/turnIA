import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator'
import { ExceptionType } from '@prisma/client'

/** Regex for "HH:MM" 24-hour time format (00:00 – 23:59). */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export class CreateScheduleExceptionDto {
  /**
   * The affected date in YYYY-MM-DD format.
   * Example: "2026-05-01"
   */
  @IsDateString()
  date!: string

  /**
   * Exception type:
   * - BLOCK:        Partial-day or full-day block (no bookings in this window)
   * - VACATION:     Full-day block — professional is on vacation
   * - HOLIDAY:      Full-day block — public or business holiday
   * - CUSTOM_HOURS: Overrides the recurring WorkSchedule for this specific date
   *
   * Rules:
   * - VACATION and HOLIDAY always block the full day regardless of startTime/endTime
   * - BLOCK without startTime/endTime = full-day block
   * - BLOCK with startTime+endTime = partial block (no bookings in that window)
   * - CUSTOM_HOURS requires both startTime and endTime (replaces the day's work window)
   */
  @IsEnum(ExceptionType)
  type!: ExceptionType

  /**
   * Start time in "HH:MM" format.
   * Required when type = CUSTOM_HOURS or for a partial BLOCK.
   */
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 09:00)' })
  startTime?: string

  /**
   * End time in "HH:MM" format. Must be after startTime.
   * Required when type = CUSTOM_HOURS or for a partial BLOCK.
   */
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 13:00)' })
  endTime?: string

  /** Optional free-text reason visible to admins (e.g. "National holiday", "Medical leave"). */
  @IsOptional()
  @IsString()
  reason?: string
}
