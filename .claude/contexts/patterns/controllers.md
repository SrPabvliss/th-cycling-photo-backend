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
import {
  CreateEventCommand,
  CreateEventDto,
  DeleteEventCommand,
  UpdateEventCommand,
  UpdateEventDto,
} from '@events/application/commands'
import { EventDetailProjection, EventListProjection } from '@events/application/projections'
import {
  GetEventDetailQuery,
  GetEventsListDto,
  GetEventsListQuery,
} from '@events/application/queries'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection, Pagination } from '@shared/application'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List events with pagination' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated event list',
    type: EventListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetEventsListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetEventsListQuery(pagination)
    return this.queryBus.execute(query)
  }

  @Get(':id')
  @SuccessMessage('success.FETCHED')
  @ApiOperation({ summary: 'Get event details by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event detail retrieved',
    type: EventDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const query = new GetEventDetailQuery(id)
    return this.queryBus.execute(query)
  }

  @Post()
  @SuccessMessage('success.CREATED')
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Event created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto) {
    const command = new CreateEventCommand(dto.name, dto.date, dto.location ?? null)
    return this.commandBus.execute(command)
  }

  @Patch(':id')
  @SuccessMessage('success.UPDATED')
  @ApiOperation({ summary: 'Update an existing event' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event updated successfully',
    type: EntityIdProjection,
  })
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
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event deleted successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async remove(@Param('id') id: string) {
    const command = new DeleteEventCommand(id)
    return this.commandBus.execute(command)
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

import { CreateEventDto } from '@events/application/commands'        // ✅ Value import
import type { CreateEventDto } from '@events/application/commands'   // ❌ Disappears at runtime
```

Biome `useImportType` is **OFF** in this project to prevent this issue.

**Barrel aliases used in controllers:**
- `@events/application/commands` — Commands, DTOs
- `@events/application/queries` — Queries, query DTOs
- `@events/application/projections` — Projection classes
- `@shared/application` — `EntityIdProjection`, `Pagination`
- `@shared/http` — `SuccessMessage`, `ApiEnvelopeResponse`, `ApiEnvelopeErrorResponse`

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
2. **Method order**: `@Get()` → `@Get(':id')` → `@Post()` → `@Patch(':id')` → `@Delete(':id')` (reads first, then writes)
3. **Always Swagger**: Every endpoint must have Swagger decorators
4. **No logic**: No validation, no business rules
5. **No try/catch**: Exception filters handle errors
6. **DTOs live with commands/queries**: Not in presentation/
7. **@SuccessMessage**: Required for i18n response messages — resolved by `ResponseInterceptor`

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
@ApiEnvelopeResponse({
  status: 201,
  description: 'Event created',
  type: EntityIdProjection,
})
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
