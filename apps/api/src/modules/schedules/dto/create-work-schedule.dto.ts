import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

/** Regex for "HH:MM" 24-hour time format (00:00 – 23:59). */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export class CreateWorkScheduleDto {
  /**
   * Branch (sucursal) where this schedule applies.
   * Optional: when omitted the API falls back to the tenant's only active
   * branch. Multi-branch tenants MUST send this so a professional can
   * legitimately have different hours per sucursal.
   */
  @IsOptional()
  @IsString()
  branchId?: string

  /**
   * Day of week: 0 = Sunday, 1 = Monday … 6 = Saturday.
   * Matches the JavaScript Date.getDay() convention.
   */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number

  /**
   * Work start time in "HH:MM" 24-hour format (tenant local timezone).
   * Must be before endTime.
   * Example: "09:00"
   */
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 09:00)' })
  startTime!: string

  /**
   * Work end time in "HH:MM" 24-hour format (tenant local timezone).
   * Must be after startTime.
   * Example: "18:00"
   */
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 18:00)' })
  endTime!: string

  /** Whether this schedule entry is currently active. Defaults to true on create. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
