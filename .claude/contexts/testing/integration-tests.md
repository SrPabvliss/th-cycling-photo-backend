# Integration Tests

> **🎯 PRIORITY:** This is the primary testing strategy for the backend.

> **Current state:** The examples in this file are the planned strategy. No integration tests (`*.integration.spec.ts`) exist yet. They will be implemented as more modules are developed.

## Overview

Integration tests verify components working together with real database.
They provide more value than unit tests for CQRS/repository patterns.

## Setup

```typescript
import { Test, type TestingModule } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { Event } from '@events/domain/entities'
import { EVENT_READ_REPOSITORY, EVENT_WRITE_REPOSITORY } from '@events/domain/ports'
import { EventReadRepository } from '@events/infrastructure/repositories/event-read.repository'
import { EventWriteRepository } from '@events/infrastructure/repositories/event-write.repository'
import { PrismaModule } from '@shared/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'

describe('EventRepositories (Integration)', () => {
  let module: TestingModule
  let writeRepo: EventWriteRepository
  let readRepo: EventReadRepository
  let prisma: PrismaService

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ['.env.test', '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
        PrismaModule,
      ],
      providers: [
        { provide: EVENT_READ_REPOSITORY, useClass: EventReadRepository },
        { provide: EVENT_WRITE_REPOSITORY, useClass: EventWriteRepository },
        EventReadRepository,
        EventWriteRepository,
      ],
    }).compile()

    writeRepo = module.get(EventWriteRepository)
    readRepo = module.get(EventReadRepository)
    prisma = module.get(PrismaService)
  })

  afterAll(async () => {
    await module.close()
  })

  beforeEach(async () => {
    // Clean database before each test (respect FK order)
    await prisma.event.deleteMany()
  })

  // Tests here...
})
```

**Key setup details:**
- `ConfigModule` is required because `PrismaService` depends on `ConfigService` for database connection
- Symbol token registration (`provide/useClass`) matches the real module setup
- Clean database in `beforeEach` respecting FK order

---

## Repository Tests

### Save and Retrieve

```typescript
describe('save', () => {
  it('should persist new event', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const event = Event.create({
      name: 'Integration Test Event',
      date: futureDate,
      location: 'Ambato',
    })

    const saved = await writeRepo.save(event)

    expect(saved.id).toBe(event.id)
    expect(saved.name).toBe('Integration Test Event')
    expect(saved.status).toBe('draft')

    // Verify in database
    const inDb = await prisma.event.findUnique({
      where: { id: event.id },
    })
    expect(inDb).not.toBeNull()
    expect(inDb!.name).toBe('Integration Test Event')
  })

  it('should update existing event (upsert)', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const event = Event.create({
      name: 'Original Name',
      date: futureDate,
      location: null,
    })

    await writeRepo.save(event)

    // Modify via domain method and save again
    event.update({ name: 'Updated Name' })
    await writeRepo.save(event)

    const updated = await readRepo.findById(event.id)
    expect(updated!.name).toBe('Updated Name')
  })
})
```

### Find Operations

```typescript
describe('findById', () => {
  it('should return event when exists', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const event = Event.create({
      name: 'Test Event',
      date: futureDate,
      location: 'Ambato',
    })
    await writeRepo.save(event)

    const found = await readRepo.findById(event.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(event.id)
    expect(found).toBeInstanceOf(Event)
  })

  it('should return null when not exists', async () => {
    const found = await readRepo.findById('non-existent-id')
    expect(found).toBeNull()
  })

  it('should return null for soft-deleted event', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const event = Event.create({ name: 'To Delete', date: futureDate, location: null })
    await writeRepo.save(event)
    await writeRepo.delete(event.id)

    const found = await readRepo.findById(event.id)
    expect(found).toBeNull()
  })
})
```

### Query with Pagination

```typescript
import { Pagination } from '@shared/application'

describe('getEventsList', () => {
  beforeEach(async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    // Seed test data
    await Promise.all([
      writeRepo.save(Event.create({ name: 'Event A', date: futureDate, location: null })),
      writeRepo.save(Event.create({ name: 'Event B', date: futureDate, location: null })),
      writeRepo.save(Event.create({ name: 'Event C', date: futureDate, location: null })),
    ])
  })

  it('should return all non-deleted events', async () => {
    const pagination = new Pagination(1, 20)
    const results = await readRepo.getEventsList(pagination)
    expect(results).toHaveLength(3)
  })

  it('should paginate results', async () => {
    const page1 = await readRepo.getEventsList(new Pagination(1, 2))
    const page2 = await readRepo.getEventsList(new Pagination(2, 2))

    expect(page1).toHaveLength(2)
    expect(page2).toHaveLength(1)
  })

  it('should exclude soft-deleted events', async () => {
    const all = await readRepo.getEventsList(new Pagination(1, 20))
    const firstId = all[0].id

    await writeRepo.delete(firstId)

    const afterDelete = await readRepo.getEventsList(new Pagination(1, 20))
    expect(afterDelete).toHaveLength(2)
    expect(afterDelete.find(e => e.id === firstId)).toBeUndefined()
  })
})
```

---

## Test Database

Use separate database for tests with individual env vars:

```env
# .env.test
NODE_ENV=test
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=cycling_test
DB_PASSWORD=test_password
DB_NAME=cycling_photos_test
```

Run migrations before tests:
```bash
NODE_ENV=test npx prisma migrate deploy
```

---

## Cleanup Strategies

### Delete All (Simple — recommended)

```typescript
beforeEach(async () => {
  // Respect FK order: children first, then parents
  await prisma.event.deleteMany()
})
```

### Transaction Rollback (Fast)

```typescript
// Prisma interactive transactions use a callback pattern.
// To rollback, throw an error inside the callback:
await prisma.$transaction(async (tx) => {
  // ... perform operations with tx ...
  // Automatic rollback if an error is thrown
})
```

> **Note:** For most integration tests, `deleteMany()` in `beforeEach` is simpler and sufficient.

---

## Test Helpers

```typescript
// test/helpers/event.helper.ts
export function createTestEvent(overrides: Partial<{
  name: string
  date: Date
  location: string | null
}> = {}): Event {
  const futureDate = new Date()
  futureDate.setFullYear(futureDate.getFullYear() + 1)

  return Event.create({
    name: overrides.name ?? 'Test Event',
    date: overrides.date ?? futureDate,
    location: overrides.location ?? null,
  })
}
```

---

## See Also

- `testing/test-guidelines.md` - General guidelines
- `testing/unit-tests.md` - Unit test patterns
- `testing/e2e-tests.md` - E2E patterns
- `infrastructure/prisma-setup.md` - Database setup
