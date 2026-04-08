import { IsString, IsOptional, IsBoolean, IsInt, Min, Matches, MinLength } from 'class-validator'

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

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

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
