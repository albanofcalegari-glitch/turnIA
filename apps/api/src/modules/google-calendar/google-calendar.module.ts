import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { GoogleCalendarController } from './google-calendar.controller'
import { GoogleCalendarService } from './google-calendar.service'

@Global()
@Module({
  imports:     [PrismaModule, ConfigModule],
  controllers: [GoogleCalendarController],
  providers:   [GoogleCalendarService],
  exports:     [GoogleCalendarService],
})
export class GoogleCalendarModule {}
