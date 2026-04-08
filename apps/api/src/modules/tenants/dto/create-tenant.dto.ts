import { IsString, IsEmail, MinLength, IsOptional, IsIn, IsBoolean } from 'class-validator'

export class CreateTenantDto {
  @IsString()
  @MinLength(3)
  name!: string

  @IsString()
  @MinLength(3)
  slug!: string

  @IsString()
  @IsIn(['peluqueria', 'barberia', 'spa', 'estetica', 'masajes', 'custom'])
  type!: string

  @IsOptional()
  @IsString()
  timezone?: string

  /**
   * Stage 1 (branches): set to true during onboarding when the business owner
   * declares they have multiple sucursales. Drives whether the dashboard
   * exposes the branch UI. Single-location tenants leave it false (default).
   */
  @IsOptional()
  @IsBoolean()
  hasMultipleBranches?: boolean

  /**
   * Optional custom name for the default branch created at onboarding.
   * Defaults to "Sucursal principal" when omitted. Useful so multi-branch
   * tenants can immediately see their first sucursal under a meaningful name.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  defaultBranchName?: string

  // Datos del admin del negocio
  @IsEmail()
  adminEmail!: string

  @IsString()
  @MinLength(6)
  adminPassword!: string

  @IsString()
  adminFirstName!: string

  @IsString()
  adminLastName!: string
}
