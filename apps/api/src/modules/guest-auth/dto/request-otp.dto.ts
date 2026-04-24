import { IsEmail, IsString } from 'class-validator'
import { IsSafeEmail } from '../../../common/validators/safe-email.validator'

export class RequestOtpDto {
  @IsString()
  tenantId!: string

  @IsEmail()
  @IsSafeEmail()
  email!: string
}
