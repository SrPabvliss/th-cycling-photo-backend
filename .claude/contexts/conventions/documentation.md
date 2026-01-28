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

## API Documentation

Use Swagger/OpenAPI decorators for endpoints:

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('events')
@Controller('events')
export class EventsController {
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: CreateEventDto) {
    // ...
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event UUID' })
  @ApiResponse({ status: 200, description: 'Event found' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    // ...
  }
}
```

---

## See Also

- `conventions/naming.md` - File and class naming
- `conventions/git.md` - Commit messages
