import { IsString, IsEmail, MinLength, IsOptional, IsIn } from 'class-validator'

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
