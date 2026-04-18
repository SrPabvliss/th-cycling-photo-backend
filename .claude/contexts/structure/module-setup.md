# NestJS Module Setup

## Overview

How to configure and register NestJS modules following Feature-Sliced architecture.

## Module Template

```typescript
// events.module.ts
import { CreateEventHandler } from '@events/application/commands/create-event/create-event.handler'
import { GetEventDetailHandler } from '@events/application/queries/get-event-detail/get-event-detail.handler'
import { GetEventsListHandler } from '@events/application/queries/get-events-list/get-events-list.handler'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { EventsController } from '@events/presentation/controllers/events.controller'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DeleteEventHandler } from './application/commands/delete-event/delete-event.handler'
import { UpdateEventHandler } from './application/commands/update-event/update-event.handler'

const CommandHandlers = [CreateEventHandler, UpdateEventHandler, DeleteEventHandler]
const QueryHandlers = [GetEventsListHandler, GetEventDetailHandler]

@Module({
  imports: [CqrsModule],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
    { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
  ],
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY],
})
export class EventsModule {}
```

**Key conventions:**
- Handlers imported individually (no barrel for handlers), grouped as `const` arrays
- Repository tokens imported via barrel: `from '@events/domain/ports'`
- Repositories registered with `provide/useClass` using Symbol tokens
- Exports use Symbol tokens (not concrete classes)

---

## Registration in app.module.ts

```typescript
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

**Key details:**
- `ConfigModule.forRoot()` uses array `envFilePath` with `.env` fallback, plus `validate` and `load`
- `I18nModule` provides bilingual support (en/es) for Swagger and API responses
- `RequestIdMiddleware` applied globally via `NestModule.configure()`
- Only implemented feature modules are imported (currently `EventsModule`)

---

## Module with External Dependencies ⚠️

> **Not yet implemented.** Pattern for when modules depend on external services (adapters).

```typescript
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { HttpModule } from '@nestjs/axios'

const Adapters = [
  RoboflowAdapter,
  GoogleVisionAdapter,
]

@Module({
  imports: [
    CqrsModule,
    HttpModule,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: SOME_READ_REPOSITORY, useClass: SomeReadRepository },
    ...Adapters,
  ],
  exports: [...Adapters],
})
export class ProcessingModule {}
```

---

## Module with BullMQ Processors ⚠️

> **Not yet implemented.** Pattern for queue-based processing modules.

```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { CqrsModule } from '@nestjs/cqrs'

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({
      name: 'photo-processing',
    }),
  ],
  providers: [
    ...CommandHandlers,
    { provide: SOME_READ_REPOSITORY, useClass: SomeReadRepository },
    PhotoProcessingProcessor,
  ],
})
export class ProcessingModule {}
```

---

## Cross-Module Dependencies

When module A needs something from module B:

```typescript
// events.module.ts
@Module({
  // ...
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY],  // Export Symbol tokens
})
export class EventsModule {}

// photos.module.ts
@Module({
  imports: [
    CqrsModule,
    EventsModule,  // Import the module
  ],
  // Now PhotosModule can inject EVENT_WRITE_REPOSITORY
})
export class PhotosModule {}
```

**Rule:** Only import what you need. Avoid circular dependencies.

---

## Shared Module Pattern

For truly shared infrastructure:

```typescript
// shared/infrastructure/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()  // Makes it available everywhere without importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Dynamic Module (with config) ⚠️

> **Not yet implemented.** Pattern for modules that need runtime configuration.

```typescript
import { type DynamicModule, Module } from '@nestjs/common'

interface StorageModuleOptions {
  bucketName: string
  region: string
}

@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: 'STORAGE_OPTIONS',
          useValue: options,
        },
        StorageService,
      ],
      exports: [StorageService],
    }
  }
}

// Usage in app.module.ts
StorageModule.forRoot({
  bucketName: process.env.B2_BUCKET_NAME,
  region: process.env.B2_REGION,
}),
```

---

## Checklist for New Module

- [ ] Create folder structure (see `structure/feature-sliced.md`)
- [ ] Create `{module}.module.ts`
- [ ] Import `CqrsModule`
- [ ] Group handlers in arrays (CommandHandlers, QueryHandlers)
- [ ] Register repositories with Symbol token `provide/useClass`
- [ ] Register controller(s)
- [ ] Export repository tokens if needed by other modules
- [ ] Use barrel alias imports (`@events/...`, `@shared/...`) for module internals
- [ ] Register module in `app.module.ts`
- [ ] Verify circular dependencies don't exist

---

## Anti-Patterns

❌ **Importing everything:**
```typescript
@Module({
  imports: [
    EventsModule,
    PhotosModule,
    ProcessingModule,
    StorageModule,
    // BAD: Importing all modules creates tight coupling
  ],
})
export class SomeModule {}
```

❌ **Exporting everything:**
```typescript
@Module({
  exports: [
    EventWriteRepository,
    EventReadRepository,
    CreateEventHandler,  // BAD: Don't export handlers
    EventsController,    // BAD: Don't export controllers
  ],
})
```

✅ **Export only what's needed (Symbol tokens):**
```typescript
@Module({
  exports: [EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY],  // GOOD: Token exports
})
```

---

## See Also

- `structure/feature-sliced.md` - Folder structure
- `infrastructure/prisma-setup.md` - PrismaModule configuration
- `infrastructure/bullmq-setup.md` - Queue module setup
