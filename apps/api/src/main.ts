import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(new ValidationPipe({
    whitelist:        true,
    forbidNonWhitelisted: true,
    transform:        true,
    transformOptions: { enableImplicitConversion: true },
  }))

  app.useGlobalFilters(new HttpExceptionFilter())

  // CORS: soporta una o múltiples origins separadas por coma.
  // Ej: CORS_ORIGINS=http://localhost:3000,http://localhost:3005
  //     CORS_ORIGINS=https://app.turnia.com
  const rawOrigins = process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3000,http://localhost:3005'
  const originList = rawOrigins.split(',').map(o => o.trim()).filter(Boolean)

  app.enableCors({
    origin:      originList.length === 1 ? originList[0] : originList,
    credentials: true,
  })

  const port = process.env.API_PORT ?? 4000
  await app.listen(port)
  console.log(`TurnIA API running on http://localhost:${port}/api/v1`)
}

bootstrap()
