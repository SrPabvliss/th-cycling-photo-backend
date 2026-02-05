import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
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

  const nodeEnv = configService.get<string>('nodeEnv')

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Cycling Photo Classification API')
      .setDescription(
        'Automated cycling photography classification system using AI cloud services.',
      )
      .setVersion('0.1.0')
      .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)

    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: '/api/docs-json',
      yamlDocumentUrl: '/api/docs-yaml',
    })

    logger.log('Swagger UI available at /api/docs')
  }

  const port = configService.get<number>('port', 3000)

  await app.listen(port)
  logger.log(`Application running on port ${port} [${nodeEnv}]`)
}
bootstrap()
