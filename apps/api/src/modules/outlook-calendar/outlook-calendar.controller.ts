import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { OutlookCalendarService } from './outlook-calendar.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtPayload } from '@turnia/shared'

@Controller('integrations/outlook')
@UseGuards(JwtAuthGuard)
export class OutlookCalendarController {
  constructor(private readonly outlook: OutlookCalendarService) {}

  @Get('auth-url')
  getAuthUrl(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    return { url: this.outlook.getAuthUrl(user.tenantId!) }
  }

  @Post('callback')
  async handleCallback(
    @CurrentUser() user: JwtPayload,
    @Body('code') code: string,
  ) {
    this.assertAdmin(user)
    const result = await this.outlook.handleCallback(code, user.tenantId!)
    return { connected: true, email: result.email }
  }

  @Post('disconnect')
  async disconnect(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    await this.outlook.disconnect(user.tenantId!)
    return { disconnected: true }
  }

  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload) {
    this.assertAdmin(user)
    return this.outlook.getStatus(user.tenantId!)
  }

  @Patch('config')
  async updateConfig(
    @CurrentUser() user: JwtPayload,
    @Body('enabled') enabled: boolean,
  ) {
    this.assertAdmin(user)
    await this.outlook.setEnabled(user.tenantId!, enabled)
    return { ok: true }
  }

  private assertAdmin(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar integraciones.')
  }
}
