import { IsEnum, IsOptional, IsString, Matches } from 'class-validator'
import { ExceptionType } from '@prisma/client'

/** Regex for "HH:MM" 24-hour time format (00:00 – 23:59). */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

/** All fields optional — send only what needs to change. */
export class UpdateScheduleExceptionDto {
  @IsOptional()
  @IsEnum(ExceptionType)
  type?: ExceptionType

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 09:00)' })
  startTime?: string

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 18:00)' })
  endTime?: string

  @IsOptional()
  @IsString()
  reason?: string
}
