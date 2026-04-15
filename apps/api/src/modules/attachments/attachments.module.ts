import { Module } from '@nestjs/common'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsService } from './attachments.service'

@Module({
  providers:   [AttachmentsService],
  controllers: [AttachmentsController],
})
export class AttachmentsModule {}
