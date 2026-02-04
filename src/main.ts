import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from './shared/http/interceptors/response.interceptor'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const reflector = app.get(Reflector)
  const logger = new Logger('Bootstrap')

  app.setGlobalPrefix('api/v1')

  app.enableCors({
    origin: configService.get('CORS_ORIGIN', '*'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(new ResponseInterceptor(reflector))

  const port = configService.get<number>('port', 3000)
  const nodeEnv = configService.get<string>('nodeEnv')

  await app.listen(port)
  logger.log(`Application running on port ${port} [${nodeEnv}]`)
}
bootstrap()
