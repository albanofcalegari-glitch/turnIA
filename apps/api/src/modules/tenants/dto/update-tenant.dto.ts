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

export class UpdateScheduleRulesDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  slotDurationMinutes?: number

  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean
}

/**
 * Tenant-owned settings that an ADMIN can change from their dashboard.
 * Keep this separate from the SuperAdmin DTO so tenant admins cannot patch
 * billing or activation fields by accident.
 */
export class UpdateMyTenantSettingsDto {
  @IsOptional()
  @IsBoolean()
  hasMultipleBranches?: boolean
}
