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

## Behavior Methods

Entities contain behavior, not just data.

```typescript
export class Event {
  // ... constructor and factory methods

  /**
   * Check if event can receive photos.
   */
  canUploadPhotos(): boolean {
    return ['DRAFT', 'UPLOADING'].includes(this.status);
  }

  /**
   * Start processing. Throws if invalid state.
   */
  startProcessing(): void {
    if (this.status !== 'UPLOADING') {
      throw AppException.businessRule('event.invalid_status_for_processing');
    }
    
    if (this.totalPhotos === 0) {
      throw AppException.businessRule('event.no_photos_to_process');
    }

    this.status = 'PROCESSING';
    this.updatedAt = new Date();
  }

  /**
   * Increment photo counter.
   */
  addPhoto(): void {
    if (!this.canUploadPhotos()) {
      throw AppException.businessRule('event.cannot_upload_photos');
    }
    
    this.totalPhotos++;
    this.updatedAt = new Date();
  }

  /**
   * Mark one photo as processed.
   */
  markPhotoProcessed(): void {
    if (this.status !== 'PROCESSING') {
      throw AppException.businessRule('event.not_processing');
    }

    this.processedPhotos++;
    this.updatedAt = new Date();

    if (this.processedPhotos >= this.totalPhotos) {
      this.status = 'COMPLETED';
    }
  }
}
```

---

## Rules

### DO:
- ✅ All business validations in factory method `create()`
- ✅ Behavior methods that modify state
- ✅ Guard clauses that throw `AppException.businessRule()`
- ✅ `readonly` for immutable fields (id, createdAt)
- ✅ `fromPersistence()` for database reconstitution
- ✅ Update `updatedAt` in mutation methods

### DON'T:
- ❌ Infrastructure dependencies (Prisma, HTTP, etc.)
- ❌ Validations in constructor
- ❌ Public setters without validation
- ❌ Direct instantiation with `new Entity()`
- ❌ Business logic in handlers or repositories

---

## Value Objects

For complex value types, create Value Objects:

```typescript
// domain/value-objects/event-status.vo.ts
export class EventStatus {
  private static readonly VALID_STATUSES = [
    'DRAFT',
    'UPLOADING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
  ] as const;

  private constructor(public readonly value: string) {}

  static create(status: string): EventStatus {
    if (!this.VALID_STATUSES.includes(status as any)) {
      throw AppException.businessRule('event.invalid_status');
    }
    return new EventStatus(status);
  }

  static draft(): EventStatus {
    return new EventStatus('DRAFT');
  }

  canTransitionTo(next: EventStatus): boolean {
    const transitions: Record<string, string[]> = {
      DRAFT: ['UPLOADING'],
      UPLOADING: ['PROCESSING', 'DRAFT'],
      PROCESSING: ['COMPLETED', 'FAILED'],
      COMPLETED: [],
      FAILED: ['DRAFT'],
    };
    return transitions[this.value]?.includes(next.value) ?? false;
  }

  equals(other: EventStatus): boolean {
    return this.value === other.value;
  }
}
```

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
