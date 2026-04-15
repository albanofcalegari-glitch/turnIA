import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { SkipMembershipCheck } from '../../common/decorators/skip-membership-check.decorator'
import { JwtPayload } from '@turnia/shared'

// Auth endpoints must never be blocked by membership state. /auth/me in
// particular is how the frontend discovers that a tenant is suspended — if
// we 403'd it the UI could never show the "membership deactivated" screen.
@SkipMembershipCheck()
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  /**
   * Returns the authenticated user's profile including tenant memberships.
   * Used by the frontend after login to resolve tenantId, role and display name.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub)
  }
}
