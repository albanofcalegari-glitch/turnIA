import { IsString, Matches, IsOptional } from 'class-validator'

export class GetAvailableDaysDto {
  /**
   * Month in YYYY-MM format.
   * Example: "2026-04"
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string

  /**
   * Branch (sucursal) to check availability against.
   * Optional for single-branch tenants.
   */
  @IsOptional()
  @IsString()
  branchId?: string

  /**
   * Comma-separated service IDs. When provided, the response also considers
   * whether all slots on a day are fully booked for these services.
   */
  @IsOptional()
  @IsString()
  serviceIds?: string
}
