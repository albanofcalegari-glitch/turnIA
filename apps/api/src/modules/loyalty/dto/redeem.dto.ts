import { IsOptional, IsString } from 'class-validator'

export class RedeemDto {
  @IsOptional()
  @IsString()
  appointmentId?: string
}
