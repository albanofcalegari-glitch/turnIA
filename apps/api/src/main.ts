import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  // Hard guard: never boot in production with the dev JWT fallback. The
  // signing key is consulted in two places (auth.module + jwt.strategy) and
  // both fall back to 'dev-secret' if missing — that would silently issue
  // tokens anyone could forge. Crash early instead.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

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

  // PORT is what most PaaS providers (Railway, Render, Fly) inject; API_PORT
  // is our local-dev convention. Honor PORT first so the same image runs in
  // production without env-var aliasing tricks.
  const port = process.env.PORT ?? process.env.API_PORT ?? 4000
  await app.listen(port)
  console.log(`TurnIA API running on http://localhost:${port}/api/v1`)
}

bootstrap()
