# Documentation Conventions

## Code Documentation

### JSDoc for Public Methods

```typescript
export class Event {
  /**
   * Factory method for creating a new event.
   * Contains all business validations.
   * 
   * @param data - Event creation data
   * @returns New Event instance
   * @throws AppException.businessRule if date is in the past
   * @throws AppException.businessRule if category is invalid
   */
  static create(data: CreateEventData): Event {
    // ...
  }

  /**
   * Check if event can receive photo uploads.
   * 
   * @returns true if status allows uploads (DRAFT or UPLOADING)
   */
  canUploadPhotos(): boolean {
    return ['DRAFT', 'UPLOADING'].includes(this.status);
  }
}
```

### When to Add JSDoc

| Add JSDoc | Skip JSDoc |
|-----------|------------|
| Public methods | Private methods |
| Factory methods | Getters/setters |
| Methods that throw | Simple CRUD operations |
| Complex logic | Self-explanatory code |
| API endpoints | Internal utilities |

### Inline Comments

Use sparingly, for "why" not "what":

```typescript
// Good: Explains why
// Roboflow returns confidence as 0-1, frontend expects 0-100
const confidence = result.confidence * 100;

// Bad: Explains what (obvious from code)
// Multiply by 100
const confidence = result.confidence * 100;
```

---

## README Structure

Each module can have a README for complex logic:

```markdown
# Events Module

## Overview
Manages cycling event lifecycle: creation, photo uploads, processing, completion.

## Key Concepts
- Event status flow: DRAFT → UPLOADING → PROCESSING → COMPLETED
- Photos can only be uploaded in DRAFT or UPLOADING status

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /events | Create event |
| GET | /events | List events |
| GET | /events/:id | Get event detail |

## Domain Rules
1. Event date cannot be in the past
2. Processing can only start with at least one photo
3. ...
```

---

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
# Changelog

## [Unreleased]

### Added
- Photo processing pipeline with Roboflow integration

### Changed
- Event status now supports FAILED state

### Fixed
- Date validation allowing past dates

## [0.1.0] - 2026-01-24

### Added
- Initial project setup
- Events CRUD
- Photos upload
```

---

## API Documentation (Swagger) — MANDATORY

⚠️ **Every module MUST include Swagger documentation.** This is not optional.

Use custom envelope decorators (not raw `@ApiResponse`):

```typescript
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiEnvelopeResponse, ApiEnvelopeErrorResponse } from '../../../../shared/http/swagger/api-envelope-response.decorator.js'

@ApiTags('Events')
@Controller('events')
export class EventsController {
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiEnvelopeResponse({ status: 201, description: 'Event created successfully', type: EntityIdProjection })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto) { ... }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({ status: 200, description: 'Event found', type: EventDetailProjection })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) { ... }
}
```

### Swagger Checklist Per Endpoint

- [ ] `@ApiTags` on controller class
- [ ] `@ApiOperation({ summary })` on each method
- [ ] `@ApiParam` for path parameters
- [ ] `@ApiEnvelopeResponse` for success responses
- [ ] `@ApiEnvelopeErrorResponse` for each error case
- [ ] `@ApiProperty`/`@ApiPropertyOptional` on DTO properties
- [ ] JSDoc comments on Projection properties
- [ ] Spanish translations in `src/i18n/es/swagger.json`

See `infrastructure/swagger-setup.md` for full configuration details.

---

## See Also

- `conventions/naming.md` - File and class naming
- `conventions/git.md` - Commit messages
