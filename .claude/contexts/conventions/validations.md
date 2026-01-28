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
import {
  IsString,
  IsNotEmpty,
  IsDate,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Name must be at least 5 characters' })
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
  @IsOptional()
  @IsEnum(['DRAFT', 'PROCESSING', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
```

---

## Handler Validation (Application Layer)

Check resource existence before operations:

```typescript
@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    private readonly eventWriteRepository: EventWriteRepository,
  ) {}

  async execute(command: UpdateEventCommand): Promise<void> {
    // Validate existence
    const event = await this.eventWriteRepository.findById(command.eventId);
    
    if (!event) {
      throw AppException.notFound('event', command.eventId);
    }

    // Proceed with update
    event.updateName(command.name);
    await this.eventWriteRepository.save(event);
  }
}
```

---

## Entity Validation (Domain Layer)

Business rules live in entities:

```typescript
export class Event {
  static create(data: CreateEventData): Event {
    // Business validations
    if (data.date < new Date()) {
      throw AppException.businessRule('event.date_in_past');
    }

    if (!['ROAD', 'MTB', 'BMX', 'TRACK'].includes(data.category)) {
      throw AppException.businessRule('event.invalid_category');
    }

    if (data.name.trim().length < 3) {
      throw AppException.businessRule('event.name_too_short');
    }

    return new Event(/* ... */);
  }

  startProcessing(): void {
    if (this.status !== 'UPLOADING') {
      throw AppException.businessRule('event.invalid_status_for_processing');
    }

    if (this.totalPhotos === 0) {
      throw AppException.businessRule('event.no_photos_to_process');
    }

    this.status = 'PROCESSING';
  }
}
```

---

## Where NOT to Validate

❌ **In Handlers (business logic):**
```typescript
// BAD: Business validation in handler
async execute(command: CreateEventCommand) {
  if (command.date < new Date()) {
    throw new Error('Invalid date');
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
      "name": ["Name must be at least 5 characters"],
      "date": ["Date is required"]
    }
  },
  "meta": {
    "requestId": "req_abc123",
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
