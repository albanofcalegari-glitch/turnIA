import { IsString, IsInt, IsDecimal, IsOptional, IsBoolean, Min, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

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
}
