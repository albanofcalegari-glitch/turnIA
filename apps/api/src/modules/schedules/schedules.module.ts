import { Module } from '@nestjs/common'
import { SchedulesService } from './schedules.service'
import { SchedulesController } from './schedules.controller'
import { BranchesModule } from '../branches/branches.module'

@Module({
  imports:     [BranchesModule],
  providers:   [SchedulesService],
  controllers: [SchedulesController],
  exports:     [SchedulesService],
})
export class SchedulesModule {}
