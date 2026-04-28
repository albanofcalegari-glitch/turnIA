import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { OutlookCalendarController } from './outlook-calendar.controller'
import { OutlookCalendarService } from './outlook-calendar.service'

@Global()
@Module({
  imports:     [PrismaModule, ConfigModule],
  controllers: [OutlookCalendarController],
  providers:   [OutlookCalendarService],
  exports:     [OutlookCalendarService],
})
export class OutlookCalendarModule {}
