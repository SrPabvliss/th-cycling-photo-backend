# Repository Pattern (Ports & Adapters)

## Overview

Repositories handle persistence using **Ports & Adapters** pattern. Interfaces (ports) live in the domain layer, implementations (adapters) in infrastructure. Separated into Write (commands) and Read (queries).

## File Structure

```
modules/{domain}/
├── domain/
│   └── ports/
│       ├── {entity}-read-repository.port.ts    # Interface + Symbol token
│       └── {entity}-write-repository.port.ts   # Interface + Symbol token
└── infrastructure/
    ├── repositories/
    │   ├── {entity}-read.repository.ts          # implements IEventReadRepository
    │   └── {entity}-write.repository.ts         # implements IEventWriteRepository
    └── mappers/
        └── {entity}.mapper.ts                   # Exported functions (not class)
```

---

## Port Interfaces (Domain Layer)

### Read Repository Port

```typescript
// domain/ports/event-read-repository.port.ts
import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import type { Pagination } from '@shared/application'
import type { Event } from '../entities'

export interface IEventReadRepository {
  findById(id: string): Promise<Event | null>
  getEventsList(pagination: Pagination): Promise<EventListProjection[]>
  getEventDetail(id: string): Promise<EventDetailProjection | null>
}

export const EVENT_READ_REPOSITORY = Symbol('EVENT_READ_REPOSITORY')
```

### Write Repository Port

```typescript
// domain/ports/event-write-repository.port.ts
import type { Event } from '../entities'

export interface IEventWriteRepository {
  save(event: Event): Promise<Event>
  delete(id: string): Promise<void>
}

export const EVENT_WRITE_REPOSITORY = Symbol('EVENT_WRITE_REPOSITORY')
```

**Key decisions:**
- `findById` lives in **ReadRepository** (semantically it's a read)
- WriteRepository only has `save()` and `delete()`
- Symbol tokens enable NestJS DI with interfaces
- Command handlers inject ReadRepository when they need to load entities

---

## Mapper (Exported Functions)

Dedicated **exported functions** (not a class) for all mapping logic.

```typescript
// infrastructure/mappers/event.mapper.ts
import type { EventDetailProjection, EventListProjection } from '@events/application/projections'
import { Event } from '@events/domain/entities'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import type { Prisma, Event as PrismaEvent } from '@generated/prisma/client'

type EventListSelect = {
  id: string
  name: string
  event_date: Date
  location: string | null
  status: string
  total_photos: number
  processed_photos: number
}

type EventDetailSelect = EventListSelect & {
  created_at: Date
  updated_at: Date
}

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Event): Prisma.EventCreateInput {
  return {
    id: entity.id,
    name: entity.name,
    event_date: entity.date,
    location: entity.location,
    status: entity.status,
    total_photos: entity.totalPhotos,
    processed_photos: entity.processedPhotos,
    created_at: entity.audit.createdAt,
    updated_at: entity.audit.updatedAt,
    deleted_at: entity.audit.deletedAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaEvent): Event {
  return Event.fromPersistence({
    id: record.id,
    name: record.name,
    date: record.event_date,
    location: record.location,
    status: record.status as EventStatusType,
    totalPhotos: record.total_photos,
    processedPhotos: record.processed_photos,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: EventListSelect): EventListProjection { ... }

/** Converts a Prisma record to a detail projection. */
export function toDetailProjection(record: EventDetailSelect): EventDetailProjection { ... }
```

**Mapper Rules:**
- Exported functions (not static class methods - avoids Biome `noStaticOnlyClass` warning)
- No dependencies (pure functions)
- Handles snake_case ↔ camelCase conversion
- Named types for Prisma select results (not inline)
- One mapper file per aggregate root
- Import as namespace: `import * as EventMapper from '../mappers/event.mapper'`
- Audit fields accessed via composition: `entity.audit.createdAt`, `entity.audit.deletedAt`

---

## Write Repository (Infrastructure)

Only `save()` and `delete()`. NO reads.

```typescript
// infrastructure/repositories/event-write.repository.ts
import type { Event } from '@events/domain/entities'
import type { IEventWriteRepository } from '@events/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventWriteRepository implements IEventWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an event entity (create or update). */
  async save(event: Event): Promise<Event> {
    const data = EventMapper.toPersistence(event)

    const saved = await this.prisma.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    })

    return EventMapper.toEntity(saved)
  }

  /** Soft-deletes an event by setting its deleted_at timestamp. */
  async delete(id: string): Promise<void> {
    await this.prisma.event.update({
      where: { id },
      data: { deleted_at: new Date() },
    })
  }
}
```

**Soft delete:** The `delete()` method does NOT call `prisma.event.delete()`. Instead it performs an `update` setting `deleted_at` to the current timestamp. The domain layer calls `writeRepo.delete(id)` without knowing about the soft-delete implementation.

---

## Read Repository (Infrastructure)

`findById()` (returns Entity for commands) + query methods (return Projections).

```typescript
// infrastructure/repositories/event-read.repository.ts
import { Injectable } from '@nestjs/common'
import type { Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type { EventDetailProjection, EventListProjection } from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a non-deleted event entity by ID for command operations. */
  async findById(id: string): Promise<Event | null> {
    const record = await this.prisma.event.findFirst({ where: { id, deleted_at: null } })
    return record ? EventMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of non-deleted events as projections. */
  async getEventsList(pagination: Pagination): Promise<EventListProjection[]> {
    const events = await this.prisma.event.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        event_date: true,
        location: true,
        status: true,
        total_photos: true,
        processed_photos: true,
      },
      orderBy: { event_date: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    })

    return events.map(EventMapper.toListProjection)
  }

  /** Retrieves a single non-deleted event's detail by ID. */
  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const record = await this.prisma.event.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        name: true,
        event_date: true,
        location: true,
        status: true,
        total_photos: true,
        processed_photos: true,
        created_at: true,
        updated_at: true,
      },
    })

    return record ? EventMapper.toDetailProjection(record) : null
  }
}
```

**Soft-delete filtering:**
- `findById` uses `findFirst` (not `findUnique`) with `{ id, deleted_at: null }` compound filter
- `getEventsList` adds `where: { deleted_at: null }` to exclude soft-deleted records
- `getEventDetail` uses `findFirst` with `{ id, deleted_at: null }` — same pattern as `findById`

**Why `findFirst` instead of `findUnique`:** `findUnique` requires all filter fields to be part of a unique index. Since the compound `{ id, deleted_at }` is not a unique constraint, `findFirst` is used instead.

---

## Module Registration

Use Symbol tokens with `provide/useClass`:

```typescript
// events.module.ts
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from './domain/ports'

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

---

## Handler Injection

Handlers use `@Inject()` with Symbol tokens and interface types. Tokens and interfaces are imported from barrel `@events/domain/ports`:

```typescript
import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    event.update({
      name: command.name,
      date: command.date,
      location: command.location,
    })

    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
```

---

## Anti-Patterns

❌ **findById in WriteRepository:**
```typescript
// BAD: Reads belong in ReadRepository
export class EventWriteRepository {
  async findById(id: string): Promise<Event | null> { ... }
}
```

❌ **Mapper as static class:**
```typescript
// BAD: Triggers Biome noStaticOnlyClass
export class EventMapper {
  static toPersistence(...) { ... }
}
```

❌ **Inline types for select results:**
```typescript
// BAD: Verbose and not reusable
export function toListProjection(record: {
  id: string; name: string; event_date: Date; ...
})
```

❌ **Direct class injection (no tokens):**
```typescript
// BAD: Couples handler to implementation
constructor(private readonly writeRepo: EventWriteRepository) {}
```

✅ **Correct: Token injection with interface:**
```typescript
constructor(
  @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
) {}
```

---

## See Also

- `patterns/cqrs.md` - Command/Query handler injection patterns
- `patterns/entities.md` - Entity and fromPersistence() method
- `infrastructure/prisma-setup.md` - PrismaService and generated client
- `infrastructure/swagger-setup.md` - Swagger documentation for endpoints
