# shared/http

Standardized HTTP response system following ADR-002.

## Components

| File | Purpose |
|------|---------|
| `filters/global-exception.filter.ts` | Catches all exceptions, formats ADR-002 error envelope |
| `interceptors/response.interceptor.ts` | Wraps successful responses in `{ data, meta }` envelope |
| `middleware/request-id.middleware.ts` | Generates UUID per request, propagates via `X-Request-Id` header |
| `decorators/success-message.decorator.ts` | Sets translatable success message on endpoints |
| `interfaces/api-response.interface.ts` | TypeScript interfaces for response shapes |
| `interfaces/express.d.ts` | Extends Express Request with `requestId` |

## Response Formats

### Success

```json
{
  "data": { "id": "uuid-here", "name": "Event" },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-24T15:30:00.000Z",
    "message": "Event created successfully"
  }
}
```

### Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Event not found",
    "shouldThrow": false,
    "fields": null,
    "details": { "entity": "event", "id": "123" },
    "stack": "Error: ..."
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-01-24T15:30:00.000Z",
    "path": "/api/v1/events/123"
  }
}
```

> `details` and `stack` only appear when `NODE_ENV=development`.

### Validation Error

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "shouldThrow": false,
    "fields": {
      "name": ["name must be a string", "name should not be empty"],
      "date": ["date must be a Date"]
    }
  },
  "meta": { "requestId": "...", "timestamp": "...", "path": "..." }
}
```

## Usage

### Throwing errors (in entities/handlers)

```typescript
import { AppException } from '../shared/domain/exceptions/app.exception'

// Resource not found
throw AppException.notFound('event', eventId)

// Business rule violation
throw AppException.businessRule('event.date_in_past')

// Business rule that frontend should propagate
throw AppException.businessRule('product.not_exists', true)

// Validation with per-field errors
throw AppException.validationFailed({
  name: ['Name is required'],
  date: ['Date cannot be in the past'],
})

// External service failure
throw AppException.externalService('Roboflow', originalError)
```

### Adding success messages to endpoints

```typescript
import { SuccessMessage } from '../shared/http/decorators/success-message.decorator'

@Post()
@SuccessMessage('success.CREATED')
async create(@Body() dto: CreateEventDto) {
  return this.commandBus.execute(new CreateEventCommand(dto))
}
```

### i18n

Translation files are in `src/i18n/{lang}/`. The `Accept-Language` header determines the language (fallback: `en`). Use the `?lang=es` query param to override.

## shouldThrow Flag

| Value | Frontend Behavior |
|-------|-------------------|
| `false` | Show toast notification only |
| `true` | Show toast + propagate to component (modal/redirect) |
