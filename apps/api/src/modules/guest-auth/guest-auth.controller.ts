import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common'
import { GuestAuthService } from './guest-auth.service'
import { SkipMembershipCheck } from '../../common/decorators/skip-membership-check.decorator'
import { RequestOtpDto } from './dto/request-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

@Controller('guest-auth')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class GuestAuthController {
  constructor(private readonly guestAuth: GuestAuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @SkipMembershipCheck()
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.guestAuth.requestOtp(dto.tenantId, dto.email)
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @SkipMembershipCheck()
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.guestAuth.verifyOtp(dto.tenantId, dto.email, dto.code)
  }
}
