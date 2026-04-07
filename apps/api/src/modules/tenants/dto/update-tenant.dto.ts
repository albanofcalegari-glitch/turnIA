import { IsOptional, IsBoolean, IsString, IsIn, IsDateString } from 'class-validator'

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
