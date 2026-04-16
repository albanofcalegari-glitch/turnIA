import { Module } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'
import { SchedulesModule } from '../schedules/schedules.module'
import { BranchesModule } from '../branches/branches.module'
import { LoyaltyModule } from '../loyalty/loyalty.module'

@Module({
  imports:     [SchedulesModule, BranchesModule, LoyaltyModule],
  providers:   [AppointmentsService],
  controllers: [AppointmentsController],
  exports:     [AppointmentsService],
})
export class AppointmentsModule {}
