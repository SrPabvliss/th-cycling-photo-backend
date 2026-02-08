# Error Handling

## Overview

All errors use `AppException`. No `DomainException` - use `AppException.businessRule()` instead.

## AppException Class

```typescript
// shared/domain/exceptions/app.exception.ts
import { HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  BUSINESS_RULE = 'BUSINESS_RULE',
  
  // Server errors (5xx)
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
}

export class AppException extends Error {
  public readonly fields?: Record<string, string[]>

  constructor(
    public readonly messageKey: string,
    public readonly httpStatus: HttpStatus,
    public readonly code: ErrorCode = ErrorCode.INTERNAL,
    public readonly shouldThrow: boolean = false,
    public readonly context?: Record<string, unknown>,
  ) {
    super(messageKey);
  }

  // ─────────────────────────────────────────────
  // Factory methods
  // ─────────────────────────────────────────────

  /** Resource not found (404) */
  static notFound(entity: string, id: string): AppException {
    return new AppException('errors.NOT_FOUND', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, false, {
      entity,
      id,
    })
  }

  /** Validation failed with per-field errors (400) */
  static validationFailed(fields: Record<string, string[]>): AppException {
    const exception = new AppException(
      'errors.VALIDATION_FAILED',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_FAILED,
      false,
    )
    ;(exception as { fields: Record<string, string[]> }).fields = fields
    return exception
  }

  /** Business rule violation (422) */
  static businessRule(messageKey: string, shouldThrow = false): AppException {
    return new AppException(
      messageKey,
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.BUSINESS_RULE,
      shouldThrow,
    )
  }

  /** External service failure (502) */
  static externalService(service: string, originalError?: Error): AppException {
    return new AppException(
      'errors.EXTERNAL_SERVICE',
      HttpStatus.BAD_GATEWAY,
      ErrorCode.EXTERNAL_SERVICE,
      false,
      { service, originalError: originalError?.message },
    )
  }

  /** Unexpected internal error (500) */
  static internal(message: string, context?: Record<string, unknown>): AppException {
    return new AppException(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL,
      false,
      context,
    )
  }
}
```

---

## Usage Examples

### In Entities (Business Rules)

```typescript
export class Event {
  static create(data: CreateEventData): Event {
    if (data.name.length < 3 || data.name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (data.date < today) throw AppException.businessRule('event.date_in_past')
    // ...
  }
}
```

Guard clauses can be one-liners when the condition is simple:
```typescript
if (data.date < today) throw AppException.businessRule('event.date_in_past')
```
This is enabled by Biome `useBlockStatements: "off"` in the project config.

### In Handlers (Resource Existence)

```typescript
async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
  const event = await this.readRepo.findById(command.id)
  if (!event) throw AppException.notFound('Event', command.id)
  // ...
}
```

Note: `notFound()` uses a generic `'errors.NOT_FOUND'` message key (not `'event.not_found'`). The entity name and ID are passed in `context` for interpolation.

### In Adapters (External Services)

```typescript
async detectObjects(imageUrl: string): Promise<DetectionResult> {
  try {
    const response = await this.httpService.post(/* ... */);
    return response.data;
  } catch (error) {
    throw AppException.externalService('Roboflow', error);
  }
}
```

---

## shouldThrow Flag

Tells frontend whether to propagate the error or just show a toast:

| Scenario | shouldThrow | Frontend Behavior |
|----------|-------------|-------------------|
| Validation error | `false` | Toast + highlight fields |
| Not found | `false` | Toast |
| Business rule (informative) | `false` | Toast |
| Business rule (needs action) | `true` | Toast + modal/redirect |
| External service failure | `false` | Toast |

```typescript
// Informative - just show toast
throw AppException.businessRule('event.already_processing');

// Needs action - frontend should show modal
throw AppException.businessRule('product.not_exists', true);
```

---

## Error Response Format

All errors follow ADR-002 envelope:

```json
{
  "error": {
    "code": "BUSINESS_RULE",
    "message": "Event date cannot be in the past",
    "shouldThrow": false,
    "details": { ... },    // Only in development
    "stack": "..."         // Only in development
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-24T15:30:00Z",
    "path": "/api/v1/events"
  }
}
```

---

## Global Exception Filter

Catches all exceptions and formats them:

```typescript
// shared/http/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const i18n = I18nContext.current(host);

    const isDevelopment = process.env.NODE_ENV === 'development';

    if (exception instanceof AppException) {
      const translatedMessage = i18n
        ? String(i18n.t(exception.messageKey, { args: exception.context }))
        : exception.messageKey;

      return response.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: translatedMessage,
          shouldThrow: exception.shouldThrow,
          ...(exception.fields && { fields: exception.fields }),
          ...(isDevelopment && {
            details: exception.context,
            stack: exception.stack,
          }),
        },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      });
    }

    // HttpException (class-validator BadRequestException, etc.)
    // are also handled — extracting per-field validation errors.

    // Unknown errors become INTERNAL
    return response.status(500).json({
      error: {
        code: 'INTERNAL',
        message: i18n ? String(i18n.t('errors.INTERNAL')) : 'An unexpected error occurred',
        shouldThrow: false,
      },
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
```

> **Note:** The actual filter also handles `HttpException` (e.g., class-validator `BadRequestException`) as a separate branch, extracting per-field validation errors via `extractValidationFields()`. All message keys are translated through `nestjs-i18n` at runtime.

---

## Common Error Codes

| Code | HTTP Status | When to Use |
|------|-------------|-------------|
| `VALIDATION_FAILED` | 400 | DTO validation errors |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `BUSINESS_RULE` | 422 | Business rule violation |
| `EXTERNAL_SERVICE` | 502 | AI/storage service failure |
| `INTERNAL` | 500 | Unexpected errors |

---

## Anti-Patterns

❌ **Using generic Error:**
```typescript
throw new Error('Invalid date');
```

❌ **Using NestJS exceptions directly:**
```typescript
throw new BadRequestException('Invalid date');
```

❌ **Not using factory methods:**
```typescript
throw new AppException('event.not_found', 404, 'NOT_FOUND', false);
```

✅ **Use factory methods:**
```typescript
throw AppException.notFound('Event', id)
throw AppException.businessRule('event.date_in_past')
```

---

## Message Key Conventions

Factory methods use **generic i18n keys** — NOT entity-specific keys:

| Factory Method | Message Key | Notes |
|---------------|-------------|-------|
| `notFound()` | `'errors.NOT_FOUND'` | Entity name in `context` |
| `validationFailed()` | `'errors.VALIDATION_FAILED'` | Field errors in `fields` |
| `businessRule()` | *caller-provided* | e.g., `'event.date_in_past'` |
| `externalService()` | `'errors.EXTERNAL_SERVICE'` | Service name in `context` |

Success messages use `@SuccessMessage()` decorator with keys like `'success.CREATED'`, `'success.UPDATED'`, `'success.DELETED'`, `'success.FETCHED'`, `'success.LIST'`.

These keys are resolved by `nestjs-i18n` at runtime via the `ResponseInterceptor` / `GlobalExceptionFilter`.

---

## See Also

- `conventions/validations.md` - Where to validate
- `infrastructure/nestjs-bootstrap.md` - Filter setup
