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
import { AppException } from '@shared/domain'
import { Event } from './event.entity'

describe('Event Entity', () => {
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  const validData = {
    name: 'Vuelta Ciclística de Ambato',
    date: futureDate,
    location: 'Ambato, Ecuador',
  }

  describe('create', () => {
    it('should create event with valid data and draft status', () => {
      const event = Event.create(validData)

      expect(event).toBeInstanceOf(Event)
      expect(event.id).toBeDefined()
      expect(event.name).toBe(validData.name)
      expect(event.status).toBe('draft')
      expect(event.totalPhotos).toBe(0)
      expect(event.audit.createdAt).toBeInstanceOf(Date)
      expect(event.audit.deletedAt).toBeNull()
    })

    it('should throw for name shorter than 3 characters', () => {
      expect(() => Event.create({ ...validData, name: 'AB' })).toThrow(AppException)
      expect(() => Event.create({ ...validData, name: 'AB' })).toThrow('event.name_invalid_length')
    })

    it('should throw for date in the past', () => {
      expect(() => Event.create({ ...validData, date: new Date('2020-01-01') })).toThrow(AppException)
      expect(() => Event.create({ ...validData, date: new Date('2020-01-01') })).toThrow('event.date_in_past')
    })
  })

  describe('update', () => {
    it('should update name when valid', () => {
      const event = Event.create(validData)
      event.update({ name: 'New Name' })
      expect(event.name).toBe('New Name')
    })

    it('should throw for invalid name on update', () => {
      const event = Event.create(validData)
      expect(() => event.update({ name: 'AB' })).toThrow(AppException)
    })

    it('should not modify fields not provided', () => {
      const event = Event.create(validData)
      const originalDate = event.date
      event.update({ name: 'Only Name Changed' })
      expect(event.date).toBe(originalDate)
    })

    it('should update updatedAt timestamp via audit', () => {
      const event = Event.create(validData)
      const originalUpdatedAt = event.audit.updatedAt
      event.update({ name: 'Updated' })
      expect(event.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })
  })

  describe('softDelete', () => {
    it('should mark event as deleted via audit', () => {
      const event = Event.create(validData)
      event.softDelete()
      expect(event.audit.deletedAt).toBeInstanceOf(Date)
      expect(event.audit.isDeleted).toBe(true)
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute entity without validations', () => {
      const event = Event.fromPersistence({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Past Event',
        date: new Date('2020-01-01'),  // past date OK in fromPersistence
        location: null,
        status: 'completed',
        totalPhotos: 100,
        processedPhotos: 95,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-06-01'),
        deletedAt: null,
      })

      expect(event.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(event.status).toBe('completed')
      expect(event.totalPhotos).toBe(100)
    })
  })
})
```

> ⚠️ **State transitions** (e.g., `startProcessing()`) will be tested when those methods are implemented on the Event entity.

---

## Handler Tests (Only if Has Logic)

**DO test** handlers with business logic:

### Create Handler (CC ≥ 3 — entity validation can fail)

```typescript
import { Event } from '@events/domain/entities'
import { IEventWriteRepository } from '@events/domain/ports'
import { AppException } from '@shared/domain'
import { CreateEventCommand } from './create-event.command'
import { CreateEventHandler } from './create-event.handler'

describe('CreateEventHandler', () => {
  let handler: CreateEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>

  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  beforeEach(() => {
    writeRepo = {
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IEventWriteRepository>
    handler = new CreateEventHandler(writeRepo)
  })

  it('should create and save event, returning id', async () => {
    const command = new CreateEventCommand('Test Event', futureDate, 'Ambato')
    writeRepo.save.mockImplementation(async (event: Event) => event)

    const result = await handler.execute(command)

    expect(result).toHaveProperty('id')
    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Event', status: 'draft' }),
    )
  })

  it('should propagate entity validation errors without calling save', async () => {
    const command = new CreateEventCommand('Test Event', new Date('2020-01-01'), null)

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })
})
```

### Delete Handler (CC ≥ 2 — notFound guard)

```typescript
import { Event } from '@events/domain/entities'
import { IEventReadRepository, IEventWriteRepository } from '@events/domain/ports'
import { AppException } from '@shared/domain'
import { DeleteEventCommand } from './delete-event.command'
import { DeleteEventHandler } from './delete-event.handler'

describe('DeleteEventHandler', () => {
  let handler: DeleteEventHandler
  let writeRepo: jest.Mocked<IEventWriteRepository>
  let readRepo: jest.Mocked<IEventReadRepository>

  const existingEvent = Event.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Vuelta Ciclística',
    date: new Date(),
    location: 'Ambato',
    status: 'draft',
    totalPhotos: 0,
    processedPhotos: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  })

  beforeEach(() => {
    writeRepo = { save: jest.fn(), delete: jest.fn() } as jest.Mocked<IEventWriteRepository>
    readRepo = {
      findById: jest.fn(),
      getEventsList: jest.fn(),
      getEventDetail: jest.fn(),
    } as jest.Mocked<IEventReadRepository>
    handler = new DeleteEventHandler(writeRepo, readRepo)
  })

  it('should soft-delete an existing event and return its id', async () => {
    readRepo.findById.mockResolvedValue(existingEvent)
    writeRepo.delete.mockResolvedValue(undefined)

    const result = await handler.execute(new DeleteEventCommand(existingEvent.id))

    expect(result).toEqual({ id: existingEvent.id })
    expect(writeRepo.delete).toHaveBeenCalledWith(existingEvent.id)
  })

  it('should throw 404 when event does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(new DeleteEventCommand('non-existent-id'))).rejects.toThrow(AppException)
    expect(writeRepo.delete).not.toHaveBeenCalled()
  })
})
```

**DO NOT test** simple delegation handlers:

```typescript
// This handler has CC = 1, no logic, NO TEST NEEDED
async execute(query: GetEventsListQuery): Promise<EventListProjection[]> {
  return this.readRepo.getEventsList(query.pagination)
}
```

---

## Mocking Patterns

```typescript
// Mock interfaces (not concrete classes) — include ALL interface methods
const writeRepo: jest.Mocked<IEventWriteRepository> = {
  save: jest.fn(),
  delete: jest.fn(),
}

const readRepo: jest.Mocked<IEventReadRepository> = {
  findById: jest.fn(),
  getEventsList: jest.fn(),
  getEventDetail: jest.fn(),
}

// With implementation
writeRepo.save.mockImplementation(async (event: Event) => event)

readRepo.findById.mockImplementation((id) =>
  id === 'existing-id' ? Promise.resolve(existingEvent) : Promise.resolve(null),
)

// Resolved/Rejected
readRepo.findById.mockResolvedValue(existingEvent)
readRepo.findById.mockResolvedValue(null)
writeRepo.delete.mockResolvedValue(undefined)
```

**Use `Event.fromPersistence()` to create test entities** with any desired state — no `as any` casts needed:

```typescript
const existingEvent = Event.fromPersistence({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Event',
  date: new Date(),
  location: 'Ambato',
  status: 'draft',
  totalPhotos: 0,
  processedPhotos: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
})
```

---

## Assertion Patterns

```typescript
// Object matching (status is lowercase)
expect(writeRepo.save).toHaveBeenCalledWith(
  expect.objectContaining({ name: 'Test Event', status: 'draft' }),
)

// Error class + message key matching
await expect(handler.execute(command)).rejects.toThrow(AppException)
await expect(handler.execute(command)).rejects.toThrow('event.date_in_past')

// Return value matching
expect(result).toEqual({ id: existingEvent.id })
expect(result).toHaveProperty('id')
expect(typeof result.id).toBe('string')

// Audit field assertions
expect(event.audit.createdAt).toBeInstanceOf(Date)
expect(event.audit.isDeleted).toBe(true)
expect(event.audit.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
```

---

## See Also

- `testing/test-guidelines.md` - Complexity criteria
- `testing/integration-tests.md` - Integration patterns (priority)
