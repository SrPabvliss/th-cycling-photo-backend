# Entity Pattern

## Overview

Entities encapsulate business logic and validations. They are created via factory methods, never directly instantiated. Audit timestamps are managed via `AuditFields` composition.

## File Location

```
modules/{domain}/domain/entities/{entity}.entity.ts
```

## Entity Template

```typescript
// modules/events/domain/entities/event.entity.ts
import { AppException, AuditFields } from '@shared/domain'
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo'

export class Event {
  constructor(
    public readonly id: string,
    public name: string,
    public date: Date,
    public location: string | null,
    public status: EventStatusType,
    public totalPhotos: number,
    public processedPhotos: number,
    public readonly audit: AuditFields,
  ) {}

  /**
   * Factory method for creating a new event.
   * Applies all business validations before instantiation.
   *
   * @param data - Event creation data (name, date, location)
   * @returns New Event instance with draft status
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  static create(data: { name: string; date: Date; location: string | null }): Event {
    Event.validateName(data.name)
    Event.validateDate(data.date)

    return new Event(
      crypto.randomUUID(),
      data.name,
      data.date,
      data.location,
      EventStatus.DRAFT,
      0,
      0,
      AuditFields.initialize(),
    )
  }

  /**
   * Updates mutable event fields with business validations.
   *
   * @param data - Partial update data
   * @throws AppException.businessRule if name length is not between 3 and 200
   * @throws AppException.businessRule if date is in the past
   */
  update(data: { name?: string; date?: Date; location?: string | null }): void {
    if (data.name !== undefined) {
      Event.validateName(data.name)
      this.name = data.name
    }

    if (data.date !== undefined) {
      Event.validateDate(data.date)
      this.date = data.date
    }

    if (data.location !== undefined) this.location = data.location

    this.audit.markUpdated()
  }

  /** Marks this event as soft-deleted. */
  softDelete(): void {
    this.audit.markDeleted()
  }

  private static validateName(name: string): void {
    if (name.length < 3 || name.length > 200) {
      throw AppException.businessRule('event.name_invalid_length')
    }
  }

  private static validateDate(date: Date): void {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) throw AppException.businessRule('event.date_in_past')
  }

  /**
   * Reconstitutes an entity from persistence data.
   * No validations are applied – the data is trusted.
   */
  static fromPersistence(data: {
    id: string
    name: string
    date: Date
    location: string | null
    status: EventStatusType
    totalPhotos: number
    processedPhotos: number
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): Event {
    return new Event(
      data.id,
      data.name,
      data.date,
      data.location,
      data.status,
      data.totalPhotos,
      data.processedPhotos,
      AuditFields.fromPersistence({
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
      }),
    )
  }
}
```

---

## AuditFields (Composition)

Audit timestamps are managed via a shared `AuditFields` class composed into entities:

```typescript
// shared/domain/audit-fields.ts
export class AuditFields {
  constructor(
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  /** Creates audit fields for a brand-new entity. */
  static initialize(): AuditFields {
    const now = new Date()
    return new AuditFields(now, now, null)
  }

  /** Reconstitutes audit fields from persisted data (no validations). */
  static fromPersistence(data: {
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
  }): AuditFields {
    return new AuditFields(data.createdAt, data.updatedAt, data.deletedAt)
  }

  /** Whether this entity has been soft-deleted. */
  get isDeleted(): boolean {
    return this.deletedAt !== null
  }

  /** Marks the entity as updated (refreshes updatedAt). */
  markUpdated(): void {
    this.updatedAt = new Date()
  }

  /** Marks the entity as soft-deleted. */
  markDeleted(): void {
    this.deletedAt = new Date()
    this.updatedAt = new Date()
  }
}
```

**Usage in entities:**
- `create()` → `AuditFields.initialize()` (sets createdAt/updatedAt to now, deletedAt to null)
- `update()` → `this.audit.markUpdated()` (refreshes updatedAt)
- `softDelete()` → `this.audit.markDeleted()` (sets deletedAt + updatedAt)
- `fromPersistence()` → `AuditFields.fromPersistence(...)` (reconstitutes from DB)

---

## Private Static Validations

Validations are extracted to `private static` methods, reused by both `create()` and `update()`:

```typescript
private static validateName(name: string): void {
  if (name.length < 3 || name.length > 200) {
    throw AppException.businessRule('event.name_invalid_length')
  }
}

private static validateDate(date: Date): void {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) throw AppException.businessRule('event.date_in_past')
}
```

**Why `private static`:**
- Reusable: same validation in `create()` and `update()`
- Testable through public API (tested via `create()` and `update()`)
- No instance access needed (validation is on the input, not the entity state)
- Date comparison zeroes hours to compare dates only (not timestamps)

---

## Soft Delete

Entities support soft delete via `AuditFields`:

```typescript
/** Marks this event as soft-deleted. */
softDelete(): void {
  this.audit.markDeleted()
}
```

The delete handler calls `entity.softDelete()` to mark it, then the write repository persists the `deleted_at` timestamp. Read repositories filter `deleted_at: null` to exclude soft-deleted records.

---

## Update Method

**Update rules:**
- Accept partial data with all fields optional
- Validate each field independently (only if provided)
- Reuse same validation methods as `create()` via `private static` methods
- Always call `this.audit.markUpdated()` at the end
- Guard clauses can be one-liners: `if (data.date < today) throw AppException.businessRule(...)`

---

## Behavior Methods

> **Note:** Additional behavior methods (e.g., status transitions for photo processing) will be added as the corresponding modules are implemented. Currently, the entity supports `create()`, `update()`, `softDelete()`, and `fromPersistence()`.

---

## Rules

### DO:
- ✅ All business validations in factory method `create()`
- ✅ `update()` method for partial updates with field-level validation
- ✅ `softDelete()` via `AuditFields.markDeleted()`
- ✅ Extract validations to `private static` methods for reuse
- ✅ Guard clauses that throw `AppException.businessRule()`
- ✅ `readonly` for immutable fields (id, audit)
- ✅ `fromPersistence()` for database reconstitution (no validations)
- ✅ `AuditFields` composition for timestamp management
- ✅ Value Objects as `as const` objects with derived types

### DON'T:
- ❌ Infrastructure dependencies (Prisma, HTTP, etc.)
- ❌ Validations in constructor
- ❌ Public setters without validation
- ❌ Direct instantiation with `new Entity()`
- ❌ Business logic in handlers or repositories
- ❌ Value Objects as classes (use `as const` pattern)
- ❌ Prisma enums in domain layer
- ❌ Direct `createdAt`/`updatedAt` fields (use `AuditFields` composition)

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
import { EventStatus, type EventStatusType } from '../value-objects/event-status.vo'

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
  const validData = {
    name: 'Vuelta al Cotopaxi 2026',
    date: new Date('2026-06-15'),
    location: 'Ambato, Ecuador',
  }

  describe('create', () => {
    it('should create event with valid data', () => {
      const event = Event.create(validData)

      expect(event).toBeInstanceOf(Event)
      expect(event.name).toBe(validData.name)
      expect(event.status).toBe('draft')
      expect(event.totalPhotos).toBe(0)
      expect(event.id).toBeDefined()
      expect(event.audit.createdAt).toBeInstanceOf(Date)
    })

    it('should throw for past date', () => {
      expect(() =>
        Event.create({ ...validData, date: new Date('2020-01-01') }),
      ).toThrow()
    })

    it('should throw for name too short', () => {
      expect(() =>
        Event.create({ ...validData, name: 'ab' }),
      ).toThrow()
    })
  })

  describe('update', () => {
    it('should update name with validation', () => {
      const event = Event.create(validData)
      event.update({ name: 'New Name' })
      expect(event.name).toBe('New Name')
    })
  })

  describe('softDelete', () => {
    it('should mark entity as deleted', () => {
      const event = Event.create(validData)
      event.softDelete()
      expect(event.audit.isDeleted).toBe(true)
      expect(event.audit.deletedAt).toBeInstanceOf(Date)
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute entity without validations', () => {
      const event = Event.fromPersistence({
        id: 'some-uuid',
        name: 'Test',
        date: new Date('2020-01-01'),  // past date OK in fromPersistence
        location: null,
        status: 'draft',
        totalPhotos: 5,
        processedPhotos: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })

      expect(event.id).toBe('some-uuid')
      expect(event.totalPhotos).toBe(5)
    })
  })
})
```

---

## See Also

- `patterns/cqrs.md` - How entities are used in handlers
- `patterns/repositories.md` - Entity persistence
- `conventions/error-handling.md` - AppException usage
- `testing/unit-tests.md` - Entity testing patterns
