# CQRS Pattern - Commands & Queries

## Overview

CQRS Light: Separate write (Commands) and read (Queries) paths without event sourcing.
Handlers use **Ports & Adapters** with `@Inject()` and Symbol tokens.

## Command Flow

```
HTTP Request → DTO (validation) → Controller → Command → Handler → Entity → Repository → DB
```

### File Structure

```
application/commands/{feature}/
├── {feature}.dto.ts          # HTTP validations + Swagger annotations
├── {feature}.command.ts      # Immutable transfer object
├── {feature}.handler.ts      # Thin orchestration
└── {feature}.handler.spec.ts # Unit tests
```

### DTO Template

```typescript
import { IsString, IsNotEmpty, IsDate, MinLength, MaxLength, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the cycling event' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @ApiProperty({ description: 'Date when the event takes place' })
  @IsDate()
  @Type(() => Date)
  date: Date

  @ApiPropertyOptional({ description: 'Physical location or address' })
  @IsString()
  @IsOptional()
  location?: string
}
```

**DTO Rules:**
- Always include `@ApiProperty` / `@ApiPropertyOptional` for Swagger
- Use `import` (not `import type`) for DTOs used in `@Body()` / `@Query()` decorators
  (required for `emitDecoratorMetadata` to emit type references)

### Command Template

```typescript
export class CreateEventCommand {
  constructor(
    public readonly name: string,
    public readonly date: Date,
    public readonly location: string | null,
  ) {}
}
```

### Command Handler Template

```typescript
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '../../../../../shared/application/projections/entity-id.projection.js'
import { Event } from '../../../domain/entities/event.entity.js'
import {
  EVENT_WRITE_REPOSITORY,
  type IEventWriteRepository,
} from '../../../domain/ports/event-write-repository.port.js'
import { CreateEventCommand } from './create-event.command.js'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
  ) {}

  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    const event = Event.create({
      name: command.name,
      date: command.date,
      location: command.location,
    })
    const saved = await this.writeRepo.save(event)
    return { id: saved.id }
  }
}
```

### Update/Delete Handler (needs both repos)

```typescript
@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
    const event = await this.readRepo.findById(command.id)
    if (!event) throw AppException.notFound('Event', command.id)

    event.update({ name: command.name, date: command.date, location: command.location })
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
```

**Handler Rules:**
- Use `@Inject(TOKEN)` with Symbol tokens (Ports & Adapters)
- Types are **interfaces** (IEventWriteRepository), not concrete classes
- Create: only WriteRepository needed
- Update/Delete: inject both ReadRepository (for findById) and WriteRepository
- Return `EntityIdProjection` from `shared/application/projections/`
- Guard clauses can be one-liners: `if (!event) throw AppException.notFound(...)`
- Thin: <30 lines ideally

---

## Query Flow

```
HTTP Request → Query Params DTO → Controller → Query → Handler → Read Repository → Projection
```

### File Structure

```
application/queries/{feature}/
├── {feature}.dto.ts          # Query params + Swagger
├── {feature}.query.ts        # Immutable object (uses Pagination composition)
└── {feature}.handler.ts      # Thin

application/projections/
├── {feature}-list.projection.ts
└── {feature}-detail.projection.ts
```

### Pagination (Composition Pattern)

```typescript
// shared/application/pagination.ts
export class Pagination {
  constructor(
    public readonly page: number,
    public readonly limit: number,
  ) {}

  get skip(): number { return (this.page - 1) * this.limit }
  get take(): number { return this.limit }
}
```

### Query Template (with Pagination)

```typescript
import type { Pagination } from '../../../../../shared/application/pagination.js'

export class GetEventsListQuery {
  constructor(public readonly pagination: Pagination) {}
}
```

### Query Handler Template

```typescript
@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
  ) {}

  async execute(query: GetEventsListQuery): Promise<EventListProjection[]> {
    return this.readRepo.getEventsList(query.pagination)
  }
}
```

### Projection Template

```typescript
/** Flat projection for event list items. */
export class EventListProjection {
  /** Unique event identifier */
  id: string
  /** Event display name */
  name: string
  /** Event date */
  date: Date
  // ... JSDoc comments enable Swagger CLI plugin introspection
}
```

**Projection independence:** Each projection is a standalone class. `EventDetailProjection` duplicates fields from `EventListProjection` — it does NOT extend or inherit from it. This keeps projections independent and avoids coupling between list and detail views.

---

## Shared Types

### EntityIdProjection

```typescript
// shared/application/projections/entity-id.projection.ts
import { ApiProperty } from '@nestjs/swagger'

export class EntityIdProjection {
  @ApiProperty({ description: 'Entity UUID' })
  id: string
}
```

Used by all command handlers that return `{ id }`.

---

## Module Registration (Handlers)

Handlers are imported individually (no barrel files) and grouped as `const` locals:

```typescript
// events.module.ts
const CommandHandlers = [CreateEventHandler, DeleteEventHandler, UpdateEventHandler]
const QueryHandlers = [GetEventDetailHandler, GetEventsListHandler]

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
- Each handler imported individually — no `index.ts` barrel
- Grouped as `const CommandHandlers` / `const QueryHandlers` for readability
- Spread into `providers` array
- Repository tokens registered via `provide/useClass`

---

## Anti-Patterns

❌ **Direct class injection (no interface):**
```typescript
constructor(private readonly writeRepo: EventWriteRepository) {}
```

❌ **Business logic in handler:**
```typescript
async execute(command: CreateEventCommand) {
  if (command.date < new Date()) throw new Error('Invalid date')
  // Should be in Entity.create()
}
```

❌ **Inline pagination in query:**
```typescript
export class GetEventsListQuery {
  constructor(
    public readonly page: number,    // BAD: use Pagination composition
    public readonly limit: number,
  ) {}
}
```

❌ **Missing Swagger on DTOs:**
```typescript
export class CreateEventDto {
  @IsString()
  name: string  // BAD: needs @ApiProperty
}
```

✅ **Correct patterns:**
```typescript
// Token injection with interface
@Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository

// Pagination composition
new GetEventsListQuery(new Pagination(dto.page ?? 1, dto.limit ?? 20))

// EntityIdProjection for command returns
return { id: saved.id }
```

---

## See Also

- `patterns/repositories.md` - Ports & Adapters, mapper functions
- `patterns/entities.md` - Factory methods and business validations
- `patterns/controllers.md` - DTO to Command/Query conversion + Swagger
- `infrastructure/swagger-setup.md` - Swagger configuration
- `conventions/error-handling.md` - AppException usage
