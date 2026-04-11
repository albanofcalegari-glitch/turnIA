import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateWorkOrderDto {
  /** Service to perform (must have minProfessionals > 1 or allowsMultiDay). */
  @IsString()
  serviceId!: string

  /**
   * Branch where the work will take place.
   * Optional for single-branch tenants (auto-resolved).
   */
  @IsOptional()
  @IsString()
  branchId?: string

  /** Client to associate (optional — can be linked later). */
  @IsOptional()
  @IsString()
  clientId?: string

  /**
   * Desired start date in ISO 8601 (UTC).
   * The system generates WorkSlots from this date forward based on the
   * service's duration and the branch's work schedule.
   */
  @IsDateString()
  startDate!: string

  /** Price override. If omitted, uses the service's catalog price. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPrice?: number

  /** Internal notes visible only to the admin. */
  @IsOptional()
  @IsString()
  notes?: string
}
