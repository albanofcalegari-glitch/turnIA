import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PrismaModule } from './prisma/prisma.module'
import { MembershipGuard } from './common/guards/membership.guard'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { BranchesModule } from './modules/branches/branches.module'
import { UsersModule } from './modules/users/users.module'
import { ServicesModule } from './modules/services/services.module'
import { ProfessionalsModule } from './modules/professionals/professionals.module'
import { SchedulesModule } from './modules/schedules/schedules.module'
import { AppointmentsModule } from './modules/appointments/appointments.module'
import { HealthModule } from './modules/health/health.module'
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module'
import { TenantMiddleware } from './common/middleware/tenant.middleware'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // JwtModule is registered here (in addition to AuthModule) so the global
    // MembershipGuard can inject it without depending on AuthModule's DI graph.
    // Uses registerAsync so the secret is read after ConfigModule loads .env
    // — otherwise process.env.JWT_SECRET is undefined at module-eval time and
    // the fallback 'dev-secret' signs tokens that JwtStrategy (constructed
    // later, with the real env loaded) can't verify.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
      }),
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    BranchesModule,
    UsersModule,
    ServicesModule,
    ProfessionalsModule,
    SchedulesModule,
    AppointmentsModule,
    HealthModule,
    SubscriptionsModule,
  ],
  providers: [
    // Global guard: enforces membership status on every authenticated request.
    // See MembershipGuard for opt-out semantics (@SkipMembershipCheck).
    { provide: APP_GUARD, useClass: MembershipGuard },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // El middleware de tenant extrae el tenantId del header o subdomain
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/(.*)',                   method: RequestMethod.ALL },
        { path: 'api/v1/tenants/register',            method: RequestMethod.POST },
        { path: 'api/v1/health',                      method: RequestMethod.GET },
        // MP webhook is called by Mercado Pago's servers — no tenant context
        // and no JWT, so tenant middleware would 401. Signature is verified
        // inside the controller instead.
        { path: 'api/v1/webhooks/mercadopago',        method: RequestMethod.POST },
      )
      .forRoutes('*')
  }
}
