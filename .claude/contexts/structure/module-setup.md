# NestJS Module Setup

## Overview

How to configure and register NestJS modules following Feature-Sliced architecture.

## Module Template

```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { EventsController } from './presentation/controllers/events.controller';

// Command Handlers
import { CreateEventHandler } from './application/commands/create-event/create-event.handler';
import { UpdateEventHandler } from './application/commands/update-event/update-event.handler';

// Query Handlers
import { GetEventsListHandler } from './application/queries/get-events-list/get-events-list.handler';
import { GetEventDetailHandler } from './application/queries/get-event-detail/get-event-detail.handler';

// Repositories
import { EventWriteRepository } from './infrastructure/repositories/event-write.repository';
import { EventReadRepository } from './infrastructure/repositories/event-read.repository';

const CommandHandlers = [
  CreateEventHandler,
  UpdateEventHandler,
];

const QueryHandlers = [
  GetEventsListHandler,
  GetEventDetailHandler,
];

const Repositories = [
  EventWriteRepository,
  EventReadRepository,
];

@Module({
  imports: [CqrsModule],
  controllers: [EventsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
  ],
  exports: [...Repositories],  // Export if other modules need them
})
export class EventsModule {}
```

---

## Registration in app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

// Feature modules
import { EventsModule } from './modules/events/events.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    
    // Shared infrastructure
    PrismaModule,
    
    // Feature modules
    EventsModule,
    PhotosModule,
    ProcessingModule,
    StorageModule,
  ],
})
export class AppModule {}
```

---

## Module with External Dependencies

When module depends on external services (adapters):

```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';

// Adapters
import { RoboflowAdapter } from './infrastructure/adapters/roboflow.adapter';
import { GoogleVisionAdapter } from './infrastructure/adapters/google-vision.adapter';

// ... handlers, repositories

const Adapters = [
  RoboflowAdapter,
  GoogleVisionAdapter,
];

@Module({
  imports: [
    CqrsModule,
    HttpModule,  // For HTTP calls to external services
  ],
  controllers: [ProcessingController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
    ...Adapters,
  ],
  exports: [...Adapters],  // If other modules need adapters
})
export class ProcessingModule {}
```

---

## Module with BullMQ Processors

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';

import { PhotoProcessingProcessor } from './infrastructure/processors/photo-processing.processor';

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({
      name: 'photo-processing',
    }),
  ],
  providers: [
    ...CommandHandlers,
    ...Repositories,
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
  exports: [EventWriteRepository],  // Export what others need
})
export class EventsModule {}

// photos.module.ts
@Module({
  imports: [
    CqrsModule,
    EventsModule,  // Import the module
  ],
  // Now PhotosModule can inject EventWriteRepository
})
export class PhotosModule {}
```

**Rule:** Only import what you need. Avoid circular dependencies.

---

## Shared Module Pattern

For truly shared infrastructure:

```typescript
// shared/infrastructure/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // Makes it available everywhere without importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Dynamic Module (with config)

```typescript
import { DynamicModule, Module } from '@nestjs/common';

interface StorageModuleOptions {
  bucketName: string;
  region: string;
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
    };
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
- [ ] Group repositories in array
- [ ] Register controller(s)
- [ ] Export repositories/adapters if needed by other modules
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

✅ **Export only what's needed:**
```typescript
@Module({
  exports: [EventWriteRepository],  // GOOD: Specific exports
})
```

---

## See Also

- `structure/feature-sliced.md` - Folder structure
- `infrastructure/prisma-setup.md` - PrismaModule configuration
- `infrastructure/bullmq-setup.md` - Queue module setup
