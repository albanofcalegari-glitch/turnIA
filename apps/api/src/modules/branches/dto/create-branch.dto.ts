import { IsString, MinLength, IsOptional, IsInt, Min, Matches } from 'class-validator'

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  name!: string

  /**
   * Optional URL-safe slug. If omitted, the service derives it from name.
   * Constrained to lowercase alphanumeric + dashes so it stays usable in
   * future branch-scoped URLs (e.g. /turnia/<tenant>/<branch>).
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El identificador debe ser minúsculas, números y guiones',
  })
  slug?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  phone?: string

  /** null/undefined → inherits Tenant.timezone at query time. */
  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}
