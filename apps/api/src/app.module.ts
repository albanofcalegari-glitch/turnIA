import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { UsersModule } from './modules/users/users.module'
import { ServicesModule } from './modules/services/services.module'
import { ProfessionalsModule } from './modules/professionals/professionals.module'
import { SchedulesModule } from './modules/schedules/schedules.module'
import { AppointmentsModule } from './modules/appointments/appointments.module'
import { HealthModule } from './modules/health/health.module'
import { TenantMiddleware } from './common/middleware/tenant.middleware'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ServicesModule,
    ProfessionalsModule,
    SchedulesModule,
    AppointmentsModule,
    HealthModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // El middleware de tenant extrae el tenantId del header o subdomain
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/(.*)', method: RequestMethod.ALL },
        { path: 'api/v1/tenants/register', method: RequestMethod.POST },
        { path: 'api/v1/health', method: RequestMethod.GET },
      )
      .forRoutes('*')
  }
}
