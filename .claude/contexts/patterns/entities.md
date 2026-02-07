# Entity Pattern

## Overview

Entities encapsulate business logic and validations. They are created via factory methods, never directly instantiated.

## File Location

```
modules/{domain}/domain/entities/{entity}.entity.ts
```

## Entity Template

```typescript
import { AppException } from '@/shared/domain/exceptions/app.exception';

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public date: Date,
    public location: string | null,
    public category: string,
    public status: string,
    public totalPhotos: number,
    public processedPhotos: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  /**
   * Factory method for creating new event.
   * Contains all business validations.
   */
  static create(data: {
    name: string;
    date: Date;
    location: string | null;
    category: string;
  }): Event {
    // Business validations
    if (data.date < new Date()) {
      throw AppException.businessRule('event.date_in_past');
    }

    if (!['ROAD', 'MTB', 'BMX', 'TRACK'].includes(data.category)) {
      throw AppException.businessRule('event.invalid_category');
    }

    return new Event(
      crypto.randomUUID(),
      data.name,
      data.date,
      data.location,
      data.category,
      'DRAFT',
      0,
      0,
      new Date(),
      new Date(),
    );
  }

  /**
   * Factory method for reconstituting from database.
   * No validations - data is already valid.
   */
  static fromPersistence(data: {
    id: string;
    name: string;
    date: Date;
    location: string | null;
    category: string;
    status: string;
    totalPhotos: number;
    processedPhotos: number;
    createdAt: Date;
    updatedAt: Date;
  }): Event {
    return new Event(
      data.id,
      data.name,
      data.date,
      data.location,
      data.category,
      data.status,
      data.totalPhotos,
      data.processedPhotos,
      data.createdAt,
      data.updatedAt,
    );
  }
}
```

---

## Update Method

Entities support partial updates via an `update()` method that validates each changed field individually.

```typescript
export class Event {
  // ... constructor, create(), fromPersistence()

  /**
   * Updates mutable event fields with business validations.
   *
   * @param data - Partial update data
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  update(data: { name?: string; date?: Date; location?: string | null }): void {
    if (data.name !== undefined) {
      if (data.name.length < 3 || data.name.length > 200) {
        throw AppException.businessRule('event.name_invalid_length')
      }
      this.name = data.name
    }

    if (data.date !== undefined) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (data.date < today) throw AppException.businessRule('event.date_in_past')
      this.date = data.date
    }

    if (data.location !== undefined) this.location = data.location

    this.updatedAt = new Date()
  }
}
```

**Update rules:**
- Accept partial data with all fields optional
- Validate each field independently (only if provided)
- Reuse same business rules as `create()`
- Always update `updatedAt` at the end
- Guard clauses can be one-liners: `if (data.date < today) throw AppException.businessRule(...)`

---

## Behavior Methods

Entities contain behavior, not just data.

```typescript
export class Event {
  // ... constructor and factory methods

  canUploadPhotos(): boolean {
    return ['DRAFT', 'UPLOADING'].includes(this.status)
  }

  startProcessing(): void {
    if (this.status !== 'UPLOADING') {
      throw AppException.businessRule('event.invalid_status_for_processing')
    }
    if (this.totalPhotos === 0) {
      throw AppException.businessRule('event.no_photos_to_process')
    }

    this.status = 'PROCESSING'
    this.updatedAt = new Date()
  }

  addPhoto(): void {
    if (!this.canUploadPhotos()) throw AppException.businessRule('event.cannot_upload_photos')
    this.totalPhotos++
    this.updatedAt = new Date()
  }

  markPhotoProcessed(): void {
    if (this.status !== 'PROCESSING') throw AppException.businessRule('event.not_processing')
    this.processedPhotos++
    this.updatedAt = new Date()

    if (this.processedPhotos >= this.totalPhotos) {
      this.status = 'COMPLETED'
    }
  }
}
```

---

## Rules

### DO:
- ✅ All business validations in factory method `create()`
- ✅ `update()` method for partial updates with field-level validation
- ✅ Behavior methods that modify state
- ✅ Guard clauses that throw `AppException.businessRule()`
- ✅ `readonly` for immutable fields (id, createdAt)
- ✅ `fromPersistence()` for database reconstitution (no validations)
- ✅ Update `updatedAt` in mutation methods
- ✅ Value Objects as `as const` objects with derived types

### DON'T:
- ❌ Infrastructure dependencies (Prisma, HTTP, etc.)
- ❌ Validations in constructor
- ❌ Public setters without validation
- ❌ Direct instantiation with `new Entity()`
- ❌ Business logic in handlers or repositories
- ❌ Value Objects as classes (use `as const` pattern)
- ❌ Prisma enums in domain layer

---

## Value Objects

Value Objects use `as const` objects with a derived type. NOT classes, NOT Prisma enums.

```typescript
// domain/value-objects/event-status.vo.ts
/**
 * Allowed statuses for an Event through its lifecycle.
 *
 * - `draft`      – Event created, no photos uploaded yet
 * - `uploading`  – Photos are being uploaded
 * - `processing` – AI processing in progress
 * - `completed`  – All photos have been processed
 */
export const EventStatus = {
  DRAFT: 'draft',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
} as const

export type EventStatusType = (typeof EventStatus)[keyof typeof EventStatus]
```

**Usage in Entity:**
```typescript
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo.js'

export class Event {
  constructor(
    // ...
    public status: EventStatusType,  // typed as 'draft' | 'uploading' | ...
  ) {}

  static create(/* ... */): Event {
    return new Event(
      // ...
      EventStatus.DRAFT,  // use constant, not string literal
    )
  }
}
```

**Why `as const` instead of class or Prisma enum:**
- Domain independence: not coupled to Prisma schema
- Lightweight: no runtime class overhead
- Type-safe: `EventStatusType` is a union of literal types
- Avoids Biome `noStaticOnlyClass` rule

---

## Testing Entities

```typescript
describe('Event Entity', () => {
  describe('create', () => {
    it('should create event with valid data', () => {
      const event = Event.create({
        name: 'Test Event',
        date: new Date('2026-05-01'),
        location: 'Ambato',
        category: 'ROAD',
      });

      expect(event).toBeInstanceOf(Event);
      expect(event.name).toBe('Test Event');
      expect(event.status).toBe('DRAFT');
      expect(event.totalPhotos).toBe(0);
      expect(event.id).toBeDefined();
    });

    it('should throw for past date', () => {
      expect(() =>
        Event.create({
          name: 'Past Event',
          date: new Date('2020-01-01'),
          location: null,
          category: 'ROAD',
        }),
      ).toThrow();
    });
  });

  describe('startProcessing', () => {
    it('should change status from UPLOADING to PROCESSING', () => {
      const event = createEventInStatus('UPLOADING', { totalPhotos: 10 });
      
      event.startProcessing();
      
      expect(event.status).toBe('PROCESSING');
    });

    it('should throw when no photos', () => {
      const event = createEventInStatus('UPLOADING', { totalPhotos: 0 });
      
      expect(() => event.startProcessing()).toThrow();
    });
  });
});
```

---

## See Also

- `patterns/cqrs.md` - How entities are used in handlers
- `patterns/repositories.md` - Entity persistence
- `conventions/error-handling.md` - AppException usage
- `testing/unit-tests.md` - Entity testing patterns
