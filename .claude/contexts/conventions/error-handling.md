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
  constructor(
    public readonly messageKey: string,
    public readonly httpStatus: HttpStatus,
    public readonly code: ErrorCode = ErrorCode.INTERNAL,
    public readonly shouldThrow: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(messageKey);
  }

  // ─────────────────────────────────────────────
  // Factory methods
  // ─────────────────────────────────────────────

  static notFound(entity: string, id: string): AppException {
    return new AppException(
      `${entity}.not_found`,
      HttpStatus.NOT_FOUND,
      ErrorCode.NOT_FOUND,
      false,
      { entity, id },
    );
  }

  static validationFailed(fields: Record<string, string[]>): AppException {
    const exception = new AppException(
      'validation.failed',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_FAILED,
      false,
    );
    (exception as any).fields = fields;
    return exception;
  }

  static businessRule(messageKey: string, shouldThrow = false): AppException {
    return new AppException(
      messageKey,
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.BUSINESS_RULE,
      shouldThrow,
    );
  }

  static externalService(service: string, originalError?: Error): AppException {
    return new AppException(
      'external_service.failed',
      HttpStatus.BAD_GATEWAY,
      ErrorCode.EXTERNAL_SERVICE,
      false,
      { service, originalError: originalError?.message },
    );
  }

  static internal(message: string, context?: Record<string, any>): AppException {
    return new AppException(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL,
      false,
      context,
    );
  }
}
```

---

## Usage Examples

### In Entities (Business Rules)

```typescript
export class Event {
  static create(data: CreateEventData): Event {
    if (data.date < new Date()) {
      throw AppException.businessRule('event.date_in_past');
    }
    // ...
  }

  startProcessing(): void {
    if (this.status !== 'UPLOADING') {
      throw AppException.businessRule('event.invalid_status_for_processing');
    }
  }
}
```

### In Handlers (Resource Existence)

```typescript
async execute(command: UpdateEventCommand): Promise<void> {
  const event = await this.repository.findById(command.eventId);
  
  if (!event) {
    throw AppException.notFound('event', command.eventId);
  }
}
```

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
// shared/infrastructure/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (exception instanceof AppException) {
      return response.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: exception.messageKey,
          shouldThrow: exception.shouldThrow,
          ...(isDevelopment && {
            details: exception.context,
            stack: exception.stack,
          }),
        },
        meta: {
          requestId: request['requestId'],
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      });
    }

    // Unknown errors become INTERNAL
    return response.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'An unexpected error occurred',
        shouldThrow: false,
      },
      meta: {
        requestId: request['requestId'],
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
```

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
throw AppException.notFound('event', id);
throw AppException.businessRule('event.date_in_past');
```

---

## See Also

- `conventions/validations.md` - Where to validate
- `infrastructure/nestjs-bootstrap.md` - Filter setup
- `conventions/http-responses.md` - Response format
