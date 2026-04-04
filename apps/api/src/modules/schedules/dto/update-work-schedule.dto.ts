import { IsBoolean, IsOptional, Matches } from 'class-validator'

/** Regex for "HH:MM" 24-hour time format (00:00 – 23:59). */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * All fields are optional — send only what you want to change.
 * dayOfWeek is intentionally excluded: to change the day, delete
 * this entry and create a new one for the target day.
 */
export class UpdateWorkScheduleDto {
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 09:00)' })
  startTime?: string

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 18:00)' })
  endTime?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
