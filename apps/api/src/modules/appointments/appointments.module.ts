import { Module } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'
import { SchedulesModule } from '../schedules/schedules.module'

@Module({
  imports:     [SchedulesModule],
  providers:   [AppointmentsService],
  controllers: [AppointmentsController],
  exports:     [AppointmentsService],
})
export class AppointmentsModule {}
