# Controller Pattern

## Overview

Controllers are thin. Convert HTTP to Commands/Queries, nothing more. Always include Swagger documentation.

## File Structure

```
presentation/controllers/
└── events.controller.ts
```

---

## Controller Template

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Pagination } from '../../../../shared/application/pagination.js'
import { EntityIdProjection } from '../../../../shared/application/projections/entity-id.projection.js'
import { SuccessMessage } from '../../../../shared/http/decorators/success-message.decorator.js'
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../../../../shared/http/swagger/api-envelope-response.decorator.js'

// Commands
import { CreateEventCommand } from '../../application/commands/create-event/create-event.command.js'
import { CreateEventDto } from '../../application/commands/create-event/create-event.dto.js'

// Queries
import { GetEventsListQuery } from '../../application/queries/get-events-list/get-events-list.query.js'
import { GetEventsListDto } from '../../application/queries/get-events-list/get-events-list.dto.js'

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @SuccessMessage('success.CREATED')
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({ status: 201, description: 'Event created successfully', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto) {
    const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
    return this.commandBus.execute(command)
  }

  @Patch(':id')
  @SuccessMessage('success.UPDATED')
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 200, description: 'Event updated successfully', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    const command = new UpdateEventCommand(id, dto.name, dto.date, dto.location)
    return this.commandBus.execute(command)
  }

  @Delete(':id')
  @SuccessMessage('success.DELETED')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 200, description: 'Event deleted successfully', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string) {
    const command = new DeleteEventCommand(id)
    return this.commandBus.execute(command)
  }

  @Get(':id')
  @SuccessMessage('success.FETCHED')
  @ApiOperation({ summary: 'Get event details by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 200, description: 'Event detail retrieved', type: EventDetailProjection })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const query = new GetEventDetailQuery(id)
    return this.queryBus.execute(query)
  }

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List events with pagination' })
  @ApiEnvelopeResponse({ status: 200, description: 'Paginated event list', type: EventListProjection, isArray: true })
  async findAll(@Query() dto: GetEventsListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetEventsListQuery(pagination)
    return this.queryBus.execute(query)
  }
}
```

---

## Swagger Decorators (Required)

Every endpoint MUST have these decorators:

| Decorator | Purpose | Required |
|-----------|---------|----------|
| `@ApiTags('Events')` | Groups endpoints | Per controller |
| `@ApiOperation({ summary })` | Endpoint description | Per endpoint |
| `@ApiParam({ name, description })` | Document path params | When `:id` etc |
| `@ApiEnvelopeResponse({ status, description, type })` | Success response (ADR-002 envelope) | Per endpoint |
| `@ApiEnvelopeErrorResponse({ status, description })` | Error response | Per error case |

**Custom envelope decorators** wrap `@ApiResponse` to match ADR-002 format:
- `ApiEnvelopeResponse` → `{ data: T, meta: { requestId, timestamp, message } }`
- `ApiEnvelopeErrorResponse` → `{ error: { code, message, ... }, meta }`

Located at: `shared/http/swagger/api-envelope-response.decorator.ts`

---

## Pagination with Composition

```typescript
@Get()
async findAll(@Query() dto: GetEventsListDto) {
  const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
  const query = new GetEventsListQuery(pagination)
  return this.queryBus.execute(query)
}
```

`Pagination` class is in `shared/application/pagination.ts` with `skip` and `take` getters.

---

## Import Rules

⚠️ **Critical for NestJS DI + Swagger:**

```typescript
// MUST be value imports (not type imports) for:
// - DTOs used in @Body() or @Query() (emitDecoratorMetadata needs the class reference)
// - CommandBus, QueryBus (DI resolution)
// - Projection classes used in @ApiEnvelopeResponse type

import { CreateEventDto } from '...'        // ✅ Value import
import type { CreateEventDto } from '...'   // ❌ Disappears at runtime
```

Biome `useImportType` is **OFF** in this project to prevent this issue.

---

## Request → Response Flow

```
POST /api/v1/events  →  DTO (class-validator)  →  Controller
  →  new CreateEventCommand(dto.name, dto.date, dto.location)
  →  commandBus.execute(command)
  →  CreateEventHandler.execute()
  →  Entity.create() + writeRepo.save()
  →  { id: saved.id }  (EntityIdProjection)
  →  ResponseInterceptor wraps in envelope: { data, meta }
```

The `@SuccessMessage('success.CREATED')` decorator sets a metadata key. The `ResponseInterceptor` reads it and resolves it via `nestjs-i18n` to produce the `meta.message` field in the response envelope.

---

## Controller Rules

1. **Thin**: Only DTO → Command/Query conversion
2. **Always Swagger**: Every endpoint must have Swagger decorators
3. **No logic**: No validation, no business rules
4. **No try/catch**: Exception filters handle errors
5. **DTOs live with commands/queries**: Not in presentation/
6. **@SuccessMessage**: Required for i18n response messages — resolved by `ResponseInterceptor`

---

## Anti-Patterns

❌ **Missing Swagger decorators:**
```typescript
@Post()
@SuccessMessage('success.CREATED')
// BAD: No @ApiOperation, no @ApiEnvelopeResponse
async create(@Body() dto: CreateEventDto) { ... }
```

❌ **import type for DTOs:**
```typescript
import type { CreateEventDto } from '...'  // BAD: breaks Swagger + DI
```

❌ **Inline pagination:**
```typescript
const query = new GetEventsListQuery(dto.page ?? 1, dto.limit ?? 20)
// BAD: use Pagination composition
```

✅ **Correct:**
```typescript
@Post()
@SuccessMessage('success.CREATED')
@ApiOperation({ summary: 'Create a new event' })
@ApiEnvelopeResponse({ status: 201, description: 'Event created', type: EntityIdProjection })
@ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
async create(@Body() dto: CreateEventDto) {
  const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
  return this.commandBus.execute(command)
}
```

---

## See Also

- `patterns/cqrs.md` - Command/Query patterns
- `infrastructure/swagger-setup.md` - Swagger configuration and bilingual setup
- `conventions/documentation.md` - JSDoc and Swagger requirements
