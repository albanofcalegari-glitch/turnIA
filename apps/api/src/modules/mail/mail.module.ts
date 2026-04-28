import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { MailService } from './mail.service'

@Global()
@Module({
  imports:   [ConfigModule, PrismaModule],
  providers: [MailService],
  exports:   [MailService],
})
export class MailModule {}
