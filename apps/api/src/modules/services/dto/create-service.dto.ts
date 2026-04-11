import { IsString, IsInt, IsOptional, IsBoolean, IsEnum, Min, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'
import { DurationUnit } from '@prisma/client'

export class CreateServiceDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsInt()
  @Min(5)
  durationMinutes!: number

  @IsInt()
  @Min(0)
  bufferBefore: number = 0

  @IsInt()
  @Min(0)
  bufferAfter: number = 0

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean

  // ── Phase 1 (work-orders): operational profile ─────────────────────────

  /** Duration unit. Defaults to MINUTES (legacy behaviour). */
  @IsOptional()
  @IsEnum(DurationUnit)
  durationUnit?: DurationUnit

  /** Numeric duration in durationUnit. 0 = use legacy durationMinutes. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  durationValue?: number

  /** Hours per workday for this service. null = tenant default. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  workdayHours?: number

  /** Minimum professionals required simultaneously. */
  @IsOptional()
  @IsInt()
  @Min(1)
  minProfessionals?: number

  /** Maximum professionals allowed simultaneously. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxProfessionals?: number

  /** Whether this service can span multiple working days. */
  @IsOptional()
  @IsBoolean()
  allowsMultiDay?: boolean
}
