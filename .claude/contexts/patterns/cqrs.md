# CQRS Pattern - Commands & Queries

## Overview

CQRS Light: Separate write (Commands) and read (Queries) paths without event sourcing.

## Command Flow

```
HTTP Request → DTO (validation) → Controller → Command → Handler → Entity → Repository → DB
```

### File Structure

```
application/commands/{feature}/
├── {feature}.dto.ts          # HTTP validations
├── {feature}.command.ts      # Immutable transfer object
└── {feature}.handler.ts      # Thin orchestration
```

### DTO Template

```typescript
import { IsString, IsNotEmpty, IsDate, IsEnum, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  name: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsString()
  @IsOptional()
  location?: string;

  @IsEnum(['ROAD', 'MTB', 'BMX', 'TRACK'])
  category: string;
}
```

### Command Template

```typescript
export class CreateEventCommand {
  constructor(
    public readonly name: string,
    public readonly date: Date,
    public readonly location: string | null,
    public readonly category: string,
  ) {}
}
```

**Rules:**
- Immutable (readonly)
- No logic or validations
- Constructor with all params
- Primitive types or VOs

### Command Handler Template

```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateEventCommand } from './create-event.command';
import { EventWriteRepository } from '@/modules/events/infrastructure/repositories/event-write.repository';
import { Event } from '@/modules/events/domain/entities/event.entity';

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    private readonly eventWriteRepository: EventWriteRepository,
  ) {}

  async execute(command: CreateEventCommand): Promise<{ id: string }> {
    // 1. Create entity with factory method (business validations inside)
    const event = Event.create({
      name: command.name,
      date: command.date,
      location: command.location,
      category: command.category,
    });

    // 2. Persist
    const savedEvent = await this.eventWriteRepository.save(event);

    // 3. Return only what's needed
    return { id: savedEvent.id };
  }
}
```

**Handler Rules:**
- Thin: <30 lines ideally
- Orchestration only
- Delegate complex logic to Domain Services
- NO validations (already in Entity)
- Transactions if multi-step

**Return Values:**
- Simple results (1-2 properties): Return inline object `{ id: string }`
- Complex results (3+ properties): Use a Projection class

---

## Query Flow

```
HTTP Request → Query Params DTO → Controller → Query → Handler → Read Repository → Projection → Response
```

### File Structure

```
application/queries/{feature}/
├── {feature}.dto.ts          # Query params
├── {feature}.query.ts        # Immutable object
└── {feature}.handler.ts      # Thin

application/projections/
└── {feature}.projection.ts   # Output DTO
```

### Query Template

```typescript
export class GetEventsListQuery {
  constructor(
    public readonly status?: string,
    public readonly dateFrom?: Date,
    public readonly dateTo?: Date,
    public readonly search?: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
```

### Query Handler Template

```typescript
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetEventsListQuery } from './get-events-list.query';
import { EventReadRepository } from '@/modules/events/infrastructure/repositories/event-read.repository';
import { EventListProjection } from '@/modules/events/application/projections/event-list.projection';

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(
    private readonly eventReadRepository: EventReadRepository,
  ) {}

  async execute(query: GetEventsListQuery): Promise<EventListProjection[]> {
    return this.eventReadRepository.getEventsList({
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }
}
```

**Rules:**
- Even simpler than Command Handler
- Repository returns Projection directly
- NO complex transformations here

### Projection Template

```typescript
export class EventListProjection {
  id: string;
  name: string;
  date: Date;
  location: string | null;
  status: string;
  totalPhotos: number;
  processedPhotos: number;
}
```

### When to Use Projections

| Return Complexity | Approach |
|-------------------|----------|
| 1-2 properties | Inline object: `{ id: string }` |
| 3+ properties | Projection class |
| List of items | Always Projection class |

**Critical:**
- Only fields frontend needs
- NO nested relations
- Flat structure preferred

---

## Anti-Patterns

❌ **Business logic in handler:**
```typescript
async execute(command: CreateEventCommand) {
  // BAD: Validations in handler
  if (command.date < new Date()) {
    throw new Error('Invalid date');
  }
  // Should be in Entity.create()
}
```

❌ **Query returning full Entity:**
```typescript
// BAD: Overfetching
return this.prisma.event.findMany({
  include: {
    photos: {
      include: {
        detected_cyclists: true
      }
    }
  }
});
```

❌ **Repository with business logic:**
```typescript
// BAD: Logic in repository
async save(event: Event) {
  if (event.status === 'COMPLETED') {
    // Should be in Entity or Domain Service
  }
}
```

✅ **Correct thin handler:**
```typescript
async execute(command: CreateEventCommand) {
  const event = Event.create(command); // Validations inside
  return this.repository.save(event);
}
```

---

## Naming Conventions

| Type | Format | Examples |
|------|--------|----------|
| Command | `{Verb}{Noun}Command` | `CreateEventCommand`, `UpdateEventStatusCommand` |
| Query | `Get{Noun}Query` | `GetEventQuery`, `GetEventsListQuery` |
| Handler | `{CommandOrQuery}Handler` | `CreateEventHandler`, `GetEventsListHandler` |
| Projection | `{Noun}Projection` | `EventListProjection`, `PhotoDetailProjection` |

---

## See Also

- `patterns/entities.md` - Factory methods and business validations
- `patterns/repositories.md` - Write/Read repository separation and mappers
- `patterns/controllers.md` - DTO to Command/Query conversion
- `conventions/error-handling.md` - AppException usage
- `conventions/validations.md` - Validation by layer
