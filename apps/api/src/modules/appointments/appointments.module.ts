import { Module } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'
import { SchedulesModule } from '../schedules/schedules.module'
import { BranchesModule } from '../branches/branches.module'

@Module({
  imports:     [SchedulesModule, BranchesModule],
  providers:   [AppointmentsService],
  controllers: [AppointmentsController],
  exports:     [AppointmentsService],
})
export class AppointmentsModule {}
