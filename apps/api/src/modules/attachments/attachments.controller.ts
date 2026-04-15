import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { AttachmentsService } from './attachments.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantId } from '../../common/decorators/tenant.decorator'
import { JwtPayload } from '@turnia/shared'

@Controller('appointments/:appointmentId/attachments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.service.list(tenantId, appointmentId)
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
  }))
  create(
    @TenantId() tenantId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.create(tenantId, appointmentId, user.sub, file)
  }

  @Delete(':id')
  remove(
    @TenantId() tenantId: string,
    @Param('appointmentId') appointmentId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(tenantId, appointmentId, id)
  }
}
