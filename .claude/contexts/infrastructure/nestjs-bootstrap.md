# NestJS Bootstrap

## Overview

Configuration of `main.ts` and global providers.

## main.ts Template

```typescript
// src/main.ts
import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory, Reflector } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from './shared/http/interceptors/response.interceptor'
import {
  loadSwaggerTranslations,
  translateDocument,
} from './shared/http/swagger/swagger-i18n.transformer'

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

    const documentEn = SwaggerModule.createDocument(app, swaggerConfig)

    const esTranslations = loadSwaggerTranslations('es')
    const documentEs = translateDocument(documentEn, esTranslations)

    SwaggerModule.setup('api/docs/en', app, documentEn, {
      jsonDocumentUrl: '/api/docs/en-json',
      yamlDocumentUrl: '/api/docs/en-yaml',
    })

    SwaggerModule.setup('api/docs/es', app, documentEs, {
      jsonDocumentUrl: '/api/docs/es-json',
      yamlDocumentUrl: '/api/docs/es-yaml',
    })

    app
      .getHttpAdapter()
      .getInstance()
      .get('/api/docs', (_req: unknown, res: { redirect: (url: string) => void }) =>
        res.redirect('/api/docs/en'),
      )

    logger.log('Swagger UI: /api/docs/en (English) | /api/docs/es (Spanish)')
  }

  const port = configService.get<number>('port', 3000)

  await app.listen(port)
  logger.log(`Application running on port ${port} [${nodeEnv}]`)
}
bootstrap()
```

**Key notes:**
- `nodeEnv` and `port` come from `configuration.ts` loader (keys are `'nodeEnv'`, `'port'`), not raw env vars
- Swagger is only enabled outside production
- `SwaggerModule.setup()` includes `jsonDocumentUrl`/`yamlDocumentUrl` for JSON/YAML export endpoints

---

## ValidationPipe Options

| Option | Value | Description |
|--------|-------|-------------|
| `whitelist` | `true` | Strip properties not in DTO |
| `forbidNonWhitelisted` | `true` | Throw if extra properties |
| `transform` | `true` | Auto-transform to DTO instance |
| `transformOptions.enableImplicitConversion` | `true` | Convert strings to numbers, etc. |

---

## @SuccessMessage Decorator

Custom decorator to define success messages per endpoint:

```typescript
// shared/http/decorators/success-message.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const SUCCESS_MESSAGE_KEY = 'successMessage'

export const SuccessMessage = (messageKey: string) => SetMetadata(SUCCESS_MESSAGE_KEY, messageKey)
```

**Usage in controllers:**
```typescript
@Post()
@SuccessMessage('success.CREATED')
async create(@Body() dto: CreateEventDto) {
  // ...
}
```

---

## Response Interceptor

Uses `Reflector` to read `@SuccessMessage()` metadata and `I18nContext` to translate:

```typescript
// shared/http/interceptors/response.interceptor.ts
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>()
    const i18n = I18nContext.current()

    const successMessageKey = this.reflector.get<string>(SUCCESS_MESSAGE_KEY, context.getHandler())

    const translatedMessage =
      successMessageKey && i18n ? String(i18n.t(successMessageKey)) : (successMessageKey ?? null)

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          message: translatedMessage,
        },
      })),
    )
  }
}
```

> **Note:** Imports `ApiSuccessResponse<T>` from `shared/http/interfaces/api-response.interface.ts`. Uses `request.requestId` (typed via `express.d.ts`). Translates success messages via `nestjs-i18n`.

**Response format:**
```json
{
  "data": { "id": "uuid-here" },
  "meta": {
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-01-24T15:30:00Z",
    "message": "Event created successfully"
  }
}
```

---

## Global Exception Filter

```typescript
// shared/http/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()
    const i18n = I18nContext.current(host)

    const isDevelopment = process.env.NODE_ENV === 'development'
    const { status, body } = this.buildResponse(exception, request, isDevelopment, i18n)

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : undefined,
    )

    response.status(status).json(body)
  }
  // ...
}
```

> **Note:** The full filter handles three branches: `AppException` (business/domain errors with i18n translation), `HttpException` (class-validator `BadRequestException` — extracts per-field validation errors via `extractValidationFields()`), and unknown errors (500). All messages are translated through `nestjs-i18n`. Uses typed `request.requestId` and returns `ApiErrorResponse` interface. See `conventions/error-handling.md` for full details.

---

## Request ID Middleware

```typescript
// shared/http/middleware/request-id.middleware.ts
import { randomUUID } from 'node:crypto'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    req.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    next()
  }
}
```

> **Note:** `req.requestId` is typed via `src/shared/http/interfaces/express.d.ts` which augments the Express `Request` interface.

---

## API Response Interfaces

```typescript
// shared/http/interfaces/api-response.interface.ts
export interface ApiSuccessResponse<T = unknown> {
  data: T
  meta: ApiMeta
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
  meta: ApiMeta
}
```

These interfaces are used by `ResponseInterceptor` and `GlobalExceptionFilter` respectively for type-safe response formatting.

---

## app.module.ts Structure

```typescript
// src/app.module.ts
import * as path from 'node:path'
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import configuration from './config/configuration'
import { validate } from './config/env.validation'
import { EventsModule } from './modules/events/events.module'
import { RequestIdMiddleware } from './shared/http/middleware/request-id.middleware'
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validate,
      load: [configuration],
      isGlobal: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
    PrismaModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}')
  }
}
```

> **Note:** Additional feature modules (`PhotosModule`, `ProcessingModule`, `StorageModule`) will be added as they are implemented. `'{*splat}'` is the NestJS 11 wildcard route syntax.

---

## File Structure

```
src/shared/http/
├── decorators/
│   └── success-message.decorator.ts
├── filters/
│   ├── global-exception.filter.ts
│   └── global-exception.filter.spec.ts
├── interceptors/
│   └── response.interceptor.ts
├── interfaces/
│   ├── api-response.interface.ts
│   └── express.d.ts
├── middleware/
│   └── request-id.middleware.ts
├── swagger/
│   ├── api-envelope-response.decorator.ts
│   ├── api-response.schema.ts
│   ├── swagger-i18n.transformer.ts
│   └── swagger-i18n.transformer.spec.ts
└── index.ts                          # Barrel file
```

---

## See Also

- `patterns/controllers.md` - @SuccessMessage usage
- `conventions/error-handling.md` - AppException details
- `infrastructure/env-config.md` - Environment setup
- `infrastructure/swagger-setup.md` - Swagger configuration
