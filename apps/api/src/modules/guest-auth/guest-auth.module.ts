import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { GuestAuthController } from './guest-auth.controller'
import { GuestAuthService } from './guest-auth.service'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: '2h' },
      }),
    }),
  ],
  controllers: [GuestAuthController],
  providers:   [GuestAuthService],
})
export class GuestAuthModule {}
