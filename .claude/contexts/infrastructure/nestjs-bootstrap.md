# NestJS Bootstrap

## Overview

Configuration of `main.ts` and global providers.

## main.ts Template

```typescript
// src/main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/infrastructure/filters/global-exception.filter';
import { ResponseInterceptor } from './shared/infrastructure/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const logger = new Logger('Bootstrap');

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: config.get('CORS_ORIGIN', '*'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  const port = config.get('PORT', 3000);
  await app.listen(port);
  
  logger.log(`Application running on port ${port}`);
}

bootstrap();
```

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
// shared/infrastructure/decorators/success-message.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SUCCESS_MESSAGE_KEY = 'successMessage';

export const SuccessMessage = (messageKey: string) =>
  SetMetadata(SUCCESS_MESSAGE_KEY, messageKey);
```

**Usage in controllers:**
```typescript
@Post()
@SuccessMessage('event.created')
async create(@Body() dto: CreateEventDto) {
  // ...
}
```

---

## Response Interceptor

Uses `Reflector` to read `@SuccessMessage()` metadata:

```typescript
// shared/infrastructure/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { SUCCESS_MESSAGE_KEY } from '../decorators/success-message.decorator';

interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    message: string | null;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get @SuccessMessage() value from handler metadata
    const successMessageKey = this.reflector.get<string>(
      SUCCESS_MESSAGE_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: request['requestId'],
          timestamp: new Date().toISOString(),
          message: successMessageKey ?? null,  // TODO: i18n translation
        },
      })),
    );
  }
}
```

**Response format:**
```json
{
  "data": { "id": "uuid-here" },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-24T15:30:00Z",
    "message": "event.created"
  }
}
```

---

## Global Exception Filter

```typescript
// shared/infrastructure/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '@/shared/domain/exceptions/app.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const isDevelopment = process.env.NODE_ENV === 'development';

    const { status, body } = this.buildResponse(
      exception,
      request,
      isDevelopment,
    );

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(body);
  }

  private buildResponse(
    exception: unknown,
    request: Request,
    isDevelopment: boolean,
  ) {
    if (exception instanceof AppException) {
      return {
        status: exception.httpStatus,
        body: {
          error: {
            code: exception.code,
            message: exception.messageKey, // TODO: i18n translation
            shouldThrow: exception.shouldThrow,
            ...(isDevelopment && {
              details: exception.context,
              stack: exception.stack,
            }),
          },
          meta: {
            requestId: request['requestId'],
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        },
      };
    }

    // Unknown errors
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL',
          message: 'An unexpected error occurred',
          shouldThrow: false,
          ...(isDevelopment && {
            details: exception instanceof Error ? exception.message : exception,
            stack: exception instanceof Error ? exception.stack : undefined,
          }),
        },
        meta: {
          requestId: request['requestId'],
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      },
    };
  }
}
```

---

## Request ID Middleware

```typescript
// shared/infrastructure/middleware/request-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req['requestId'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
```

---

## app.module.ts Structure

```typescript
// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './shared/infrastructure/middleware/request-id.middleware';

// Shared
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { WebSocketsModule } from './shared/websockets/websockets.module';

// Features
import { EventsModule } from './modules/events/events.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    PrismaModule,
    WebSocketsModule,
    EventsModule,
    PhotosModule,
    ProcessingModule,
    StorageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

---

## File Structure

```
src/shared/infrastructure/
├── decorators/
│   └── success-message.decorator.ts
├── filters/
│   └── global-exception.filter.ts
├── interceptors/
│   └── response.interceptor.ts
└── middleware/
    └── request-id.middleware.ts
```

---

## See Also

- `patterns/controllers.md` - @SuccessMessage usage
- `conventions/http-responses.md` - Response envelope format
- `conventions/error-handling.md` - AppException details
- `infrastructure/env-config.md` - Environment setup
