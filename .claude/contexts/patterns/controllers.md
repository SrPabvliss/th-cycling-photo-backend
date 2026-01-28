# Controller Pattern

## Overview

Controllers are thin. Convert HTTP to Commands/Queries, nothing more.

## File Structure

```
presentation/controllers/
└── events.controller.ts
```

---

## Controller Template

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SuccessMessage } from '@/shared/infrastructure/decorators/success-message.decorator';

// Commands
import { CreateEventCommand } from '../../application/commands/create-event/create-event.command';
import { CreateEventDto } from '../../application/commands/create-event/create-event.dto';

// Queries
import { GetEventsListQuery } from '../../application/queries/get-events-list/get-events-list.query';
import { GetEventsListDto } from '../../application/queries/get-events-list/get-events-list.dto';

@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @SuccessMessage('event.created')
  async create(@Body() dto: CreateEventDto) {
    const command = new CreateEventCommand(
      dto.name,
      dto.date,
      dto.location ?? null,
      dto.category,
    );

    return this.commandBus.execute(command);
  }

  @Get()
  @SuccessMessage('event.list_retrieved')
  async findAll(@Query() dto: GetEventsListDto) {
    const query = new GetEventsListQuery(
      dto.status,
      dto.dateFrom,
      dto.dateTo,
      dto.search,
      dto.page ?? 1,
      dto.limit ?? 20,
    );

    return this.queryBus.execute(query);
  }

  @Get(':id')
  @SuccessMessage('event.retrieved')
  async findOne(@Param('id') id: string) {
    const query = new GetEventDetailQuery(id);
    return this.queryBus.execute(query);
  }

  @Patch(':id')
  @SuccessMessage('event.updated')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    const command = new UpdateEventCommand(id, dto.name, dto.location);
    return this.commandBus.execute(command);
  }

  @Delete(':id')
  @SuccessMessage('event.deleted')
  async remove(@Param('id') id: string) {
    const command = new DeleteEventCommand(id);
    return this.commandBus.execute(command);
  }
}
```

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

**Usage:**
```typescript
@Post()
@SuccessMessage('event.created')  // Key for i18n translation
async create(@Body() dto: CreateEventDto) {
  // ...
}
```

The `ResponseInterceptor` reads this metadata and includes it in the response envelope.

---

## Controller Rules

1. **Thin**: Only DTO → Command/Query conversion
2. **No logic**: No validation, no business rules
3. **No try/catch**: Exception filters handle errors
4. **DTOs live with commands/queries**: Not in presentation/

## Response Format

Controllers return raw data. `ResponseInterceptor` wraps in envelope:

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

## Multiple Controllers (Sub-resources)

```typescript
// events.controller.ts - CRUD for events
@Controller('events')
export class EventsController { ... }

// event-photos.controller.ts - Photos within event
@Controller('events/:eventId/photos')
export class EventPhotosController {
  @Post()
  @SuccessMessage('photo.uploaded')
  async uploadPhoto(
    @Param('eventId') eventId: string,
    @Body() dto: UploadPhotoDto,
  ) {
    const command = new UploadPhotoCommand(eventId, dto.file);
    return this.commandBus.execute(command);
  }

  @Get()
  @SuccessMessage('photo.list_retrieved')
  async listPhotos(@Param('eventId') eventId: string) {
    const query = new GetEventPhotosQuery(eventId);
    return this.queryBus.execute(query);
  }
}
```

---

## Anti-Patterns

❌ **Logic in controller:**
```typescript
@Post()
async create(@Body() dto: CreateEventDto) {
  // BAD: Validation logic here
  if (dto.date < new Date()) {
    throw new BadRequestException('Invalid date');
  }
}
```

❌ **Direct repository access:**
```typescript
@Get(':id')
async findOne(@Param('id') id: string) {
  // BAD: Should use QueryBus
  return this.eventRepository.findById(id);
}
```

❌ **Manual try/catch:**
```typescript
@Post()
async create(@Body() dto: CreateEventDto) {
  try {
    // BAD: Let exception filter handle
  } catch (error) {
    throw new InternalServerErrorException();
  }
}
```

❌ **Missing @SuccessMessage:**
```typescript
@Post()
// BAD: No success message defined
async create(@Body() dto: CreateEventDto) {
  // Response won't have message field
}
```

✅ **Correct thin controller:**
```typescript
@Post()
@SuccessMessage('event.created')
async create(@Body() dto: CreateEventDto) {
  const command = new CreateEventCommand(/* ... */);
  return this.commandBus.execute(command);
}
```

---

## Global ValidationPipe

Configured in `main.ts`, no need to add per controller:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

---

## Handling Optional Params

```typescript
@Post()
@SuccessMessage('event.created')
async create(@Body() dto: CreateEventDto) {
  const command = new CreateEventCommand(
    dto.name,
    dto.date,
    dto.location ?? null,    // Handle undefined → null
    dto.category,
  );
  return this.commandBus.execute(command);
}

@Get()
@SuccessMessage('event.list_retrieved')
async findAll(@Query() dto: GetEventsListDto) {
  const query = new GetEventsListQuery(
    dto.status,
    dto.dateFrom,
    dto.dateTo,
    dto.search,
    dto.page ?? 1,           // Default pagination
    dto.limit ?? 20,
  );
  return this.queryBus.execute(query);
}
```

---

## See Also

- `patterns/cqrs.md` - Command/Query patterns
- `infrastructure/nestjs-bootstrap.md` - ResponseInterceptor with Reflector
- `conventions/http-responses.md` - Response envelope format
- `conventions/validations.md` - DTO validation
