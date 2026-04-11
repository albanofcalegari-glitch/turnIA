import { Module } from '@nestjs/common'
import { WorkOrdersService } from './work-orders.service'
import { WorkOrdersController } from './work-orders.controller'
import { BranchesModule } from '../branches/branches.module'

@Module({
  imports:     [BranchesModule],
  providers:   [WorkOrdersService],
  controllers: [WorkOrdersController],
  exports:     [WorkOrdersService],
})
export class WorkOrdersModule {}
