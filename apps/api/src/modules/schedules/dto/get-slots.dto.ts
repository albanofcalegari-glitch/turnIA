import { IsDateString, IsArray, IsString, IsOptional, ArrayMinSize } from 'class-validator'
import { Transform } from 'class-transformer'

export class GetSlotsDto {
  /**
   * Date in YYYY-MM-DD format, interpreted in the tenant's configured timezone.
   * Example: "2026-04-15"
   */
  @IsDateString()
  date!: string

  /**
   * Ordered list of service IDs to book in sequence.
   * Accepts a comma-separated string (query param) or an array.
   * Order matters: services are booked sequentially in the given order.
   * Example: "svc_abc123,svc_def456" or ["svc_abc123","svc_def456"]
   */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((s: string) => s.trim()) : value
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serviceIds!: string[]

  /**
   * Branch (sucursal) at which the booking will take place.
   * Optional for single-branch tenants: when omitted the API falls back to
   * the tenant's only active branch (BranchesService.resolveBranchId).
   * Multi-branch tenants MUST send this — otherwise the request fails with
   * 400 because there is no unambiguous default to choose.
   */
  @IsOptional()
  @IsString()
  branchId?: string
}
