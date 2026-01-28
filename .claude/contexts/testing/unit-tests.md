# Unit Tests

## When to Write Unit Tests

**Only for code with Cyclomatic Complexity ≥ 5** or important business logic.

### Test This ✅
- Entity factory methods with multiple validations
- State machine transitions
- Complex calculations
- Business rule enforcement

### Skip This ❌
- Simple getters/setters
- Handlers that only call repository
- Code with CC ≤ 2
- CRUD without logic

---

## Entity Tests (When CC ≥ 5)

```typescript
import { Event } from './event.entity';
import { AppException } from '@/shared/domain/exceptions/app.exception';

describe('Event Entity', () => {
  describe('create', () => {
    // Happy path
    it('should create event with valid data', () => {
      const event = Event.create({
        name: 'Test Event',
        date: new Date('2026-05-01'),
        location: 'Ambato',
        category: 'ROAD',
      });

      expect(event).toBeInstanceOf(Event);
      expect(event.status).toBe('DRAFT');
    });

    // Each validation branch
    it('should throw for past date', () => {
      expect(() =>
        Event.create({
          name: 'Past Event',
          date: new Date('2020-01-01'),
          location: null,
          category: 'ROAD',
        }),
      ).toThrow(AppException);
    });

    it('should throw for invalid category', () => {
      expect(() =>
        Event.create({
          name: 'Test',
          date: new Date('2026-05-01'),
          location: null,
          category: 'INVALID',
        }),
      ).toThrow();
    });
  });

  // State transitions (if CC ≥ 3)
  describe('startProcessing', () => {
    it('should change status to PROCESSING', () => {
      const event = createTestEvent({ status: 'UPLOADING', totalPhotos: 10 });
      event.startProcessing();
      expect(event.status).toBe('PROCESSING');
    });

    it('should throw when not in UPLOADING status', () => {
      const event = createTestEvent({ status: 'DRAFT' });
      expect(() => event.startProcessing()).toThrow(AppException);
    });
  });
});

// Helper
function createTestEvent(overrides: Partial<{ status: string; totalPhotos: number }> = {}): Event {
  const event = Event.create({
    name: 'Test Event',
    date: new Date('2026-05-01'),
    location: null,
    category: 'ROAD',
  });
  if (overrides.status) (event as any).status = overrides.status;
  if (overrides.totalPhotos !== undefined) (event as any).totalPhotos = overrides.totalPhotos;
  return event;
}
```

---

## Handler Tests (Only if Has Logic)

**DO test** handlers with business logic:

```typescript
describe('CreateEventHandler', () => {
  let handler: CreateEventHandler;
  let repository: jest.Mocked<EventWriteRepository>;

  beforeEach(async () => {
    repository = { save: jest.fn() } as any;
    handler = new CreateEventHandler(repository);
  });

  it('should create and save event', async () => {
    const command = new CreateEventCommand('Test', new Date('2026-05-01'), 'ROAD');
    repository.save.mockResolvedValue(mockEvent);

    const result = await handler.execute(command);

    expect(result).toHaveProperty('id');
    expect(repository.save).toHaveBeenCalled();
  });

  it('should propagate entity validation errors', async () => {
    const command = new CreateEventCommand('Test', new Date('2020-01-01'), 'ROAD');

    await expect(handler.execute(command)).rejects.toThrow(AppException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
```

**DO NOT test** simple delegation handlers:

```typescript
// This handler has CC = 1, no logic, NO TEST NEEDED
async execute(query: GetEventQuery): Promise<EventProjection> {
  return this.repository.findById(query.id);
}
```

---

## Mocking Patterns

```typescript
// Simple mock
const mockRepository = {
  save: jest.fn(),
  findById: jest.fn(),
};

// With implementation
repository.findById.mockImplementation((id) =>
  id === 'existing-id' ? Promise.resolve(mockEvent) : Promise.resolve(null)
);

// Resolved/Rejected
repository.save.mockResolvedValue(mockEvent);
repository.save.mockRejectedValue(new Error('DB error'));
```

---

## Assertion Patterns

```typescript
// Object matching
expect(repository.save).toHaveBeenCalledWith(
  expect.objectContaining({ name: 'Test', status: 'DRAFT' })
);

// Error matching
await expect(handler.execute(command)).rejects.toThrow(AppException);
await expect(handler.execute(command)).rejects.toThrow('date_in_past');
```

---

## See Also

- `testing/test-guidelines.md` - Complexity criteria
- `testing/integration-tests.md` - Integration patterns (priority)
