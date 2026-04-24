import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { GoogleCalendarService } from './google-calendar.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtPayload } from '@turnia/shared'

@Controller('integrations/google')
@UseGuards(JwtAuthGuard)
export class GoogleCalendarController {
  constructor(private readonly gcal: GoogleCalendarService) {}

  @Get('auth-url')
  getAuthUrl(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    return { url: this.gcal.getAuthUrl(user.tenantId!) }
  }

  @Post('callback')
  async handleCallback(
    @CurrentUser() user: JwtPayload,
    @Body('code') code: string,
  ) {
    this.assertAdmin(user)
    const result = await this.gcal.handleCallback(code, user.tenantId!)
    return { connected: true, email: result.email }
  }

  @Post('disconnect')
  async disconnect(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    await this.gcal.disconnect(user.tenantId!)
    return { disconnected: true }
  }

  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    return this.gcal.getStatus(user.tenantId!)
  }

  @Patch('config')
  async updateConfig(
    @CurrentUser() user: JwtPayload,
    @Body('enabled') enabled: boolean,
  ) {
    this.assertAdmin(user)
    await this.gcal.setEnabled(user.tenantId!, enabled)
    return { ok: true }
  }

  private assertAdmin(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar integraciones.')
  }
}
