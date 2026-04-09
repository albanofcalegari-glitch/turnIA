import { IsOptional, IsBoolean, IsString, IsIn, IsDateString, IsInt, Min, Max } from 'class-validator'

export class UpdateTenantDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  @IsIn(['free', 'starter', 'pro'])
  plan?: string

  @IsOptional()
  @IsDateString()
  membershipExpiresAt?: string | null
}

/**
 * Patch payload for the tenant's own admin to edit `schedule_rules`. Today
 * only `slotDurationMinutes` is editable from the dashboard — the other
 * fields stay at their defaults until we build UI for them.
 */
export class UpdateScheduleRulesDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDurationMinutes?: number
}
