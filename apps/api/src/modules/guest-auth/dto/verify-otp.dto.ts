import { IsEmail, IsString, Length } from 'class-validator'
import { IsSafeEmail } from '../../../common/validators/safe-email.validator'

export class VerifyOtpDto {
  @IsString()
  tenantId!: string

  @IsEmail()
  @IsSafeEmail()
  email!: string

  @IsString()
  @Length(6, 6)
  code!: string
}
