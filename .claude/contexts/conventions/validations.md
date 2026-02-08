# Validation Conventions

## Validation by Layer

| Layer | What to Validate | Tool | Example |
|-------|------------------|------|---------|
| Presentation (DTO) | HTTP format, types, ranges | `class-validator` | `@IsString()`, `@Min(1)` |
| Application (Handler) | Resource existence | Repository + AppException | `notFound()` |
| Domain (Entity) | Business rules, invariants | Native code + AppException | "Date cannot be in past" |

---

## DTO Validation (Presentation Layer)

Use `class-validator` decorators for HTTP input validation:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the cycling event', example: 'Vuelta al Cotopaxi 2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @ApiProperty({ description: 'Date when the event takes place', example: '2026-06-15T08:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  date: Date

  @ApiPropertyOptional({ description: 'Physical location or address', example: 'Ambato, Ecuador' })
  @IsString()
  @IsOptional()
  location?: string
}
```

### Common Decorators

| Decorator | Use Case |
|-----------|----------|
| `@IsString()` | String type |
| `@IsNumber()` | Number type |
| `@IsDate()` | Date type (with `@Type(() => Date)`) |
| `@IsEnum(enum)` | Enum value |
| `@IsOptional()` | Nullable field |
| `@IsNotEmpty()` | Non-empty string |
| `@Min(n)` / `@Max(n)` | Number range |
| `@MinLength(n)` / `@MaxLength(n)` | String length |
| `@IsArray()` | Array type |
| `@ArrayMaxSize(n)` | Max array items |

### Query Params DTO

```typescript
export class GetEventsListDto {
  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 20, max 100)', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number
}
```

> **Note:** Pagination defaults are applied in the controller (`dto.page ?? 1, dto.limit ?? 20`), not in the DTO. `@Type(() => Number)` is not needed because the global `ValidationPipe` has `enableImplicitConversion: true`.

---

## Handler Validation (Application Layer)

Check resource existence before operations:

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

## Entity Validation (Domain Layer)

Business rules live in entities:

```typescript
export class Event {
  static create(data: { name: string; date: Date; location: string | null }): Event {
    Event.validateName(data.name)
    Event.validateDate(data.date)

    return new Event(
      crypto.randomUUID(),
      data.name,
      data.date,
      data.location,
      EventStatus.DRAFT,
      0,
      0,
      AuditFields.initialize(),
    )
  }

  update(data: { name?: string; date?: Date; location?: string | null }): void {
    if (data.name !== undefined) {
      Event.validateName(data.name)
      this.name = data.name
    }
    if (data.date !== undefined) {
      Event.validateDate(data.date)
      this.date = data.date
    }
    if (data.location !== undefined) this.location = data.location

    this.audit.markUpdated()
  }

  private static validateName(name: string): void {
    if (name.length < 3 || name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }
  }

  private static validateDate(date: Date): void {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) throw AppException.businessRule('event.date_in_past')
  }
}
```

Key patterns:
- Validations extracted to `private static` methods, reused by both `create()` and `update()`
- Date comparison zeroes hours to compare dates only (not timestamps)
- `AuditFields` composition for timestamp management

---

## Where NOT to Validate

❌ **In Handlers (business logic):**
```typescript
// BAD: Business validation in handler
async execute(command: CreateEventCommand) {
  if (command.date < new Date()) {
    throw AppException.businessRule('event.date_in_past')
  }
}
```

❌ **In Repositories:**
```typescript
// BAD: Any validation in repository
async save(event: Event) {
  if (event.status === 'INVALID') {
    throw new Error('Invalid status');
  }
}
```

❌ **In Controllers:**
```typescript
// BAD: Manual validation in controller
@Post()
async create(@Body() dto: CreateEventDto) {
  if (!dto.name) {
    throw new BadRequestException('Name required');
  }
}
```

---

## Validation Error Format

Validation errors follow ADR-002 format:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation error",
    "shouldThrow": false,
    "fields": {
      "name": ["name must be longer than or equal to 3 characters"],
      "date": ["date must be a Date instance"]
    }
  },
  "meta": {
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-01-24T15:30:00Z",
    "path": "/api/v1/events"
  }
}
```

---

## See Also

- `patterns/entities.md` - Entity validation patterns
- `patterns/cqrs.md` - Handler patterns
- `conventions/error-handling.md` - AppException usage
