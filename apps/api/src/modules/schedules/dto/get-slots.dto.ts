import { IsDateString, IsArray, IsString, ArrayMinSize } from 'class-validator'
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
}
