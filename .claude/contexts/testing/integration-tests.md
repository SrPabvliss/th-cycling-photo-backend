# Integration Tests

> **🎯 PRIORITY:** This is the primary testing strategy for the backend.

## Overview

Integration tests verify components working together with real database.
They provide more value than unit tests for CQRS/repository patterns.

## Setup

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { PrismaModule } from '@/shared/infrastructure/prisma/prisma.module';
import { EventWriteRepository } from './event-write.repository';
import { Event } from '@/modules/events/domain/entities/event.entity';

describe('EventWriteRepository (Integration)', () => {
  let module: TestingModule;
  let repository: EventWriteRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [EventWriteRepository],
    }).compile();

    repository = module.get(EventWriteRepository);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.photo.deleteMany();
    await prisma.event.deleteMany();
  });

  // Tests here...
});
```

---

## Repository Tests

### Save and Retrieve

```typescript
describe('save', () => {
  it('should persist new event', async () => {
    const event = Event.create({
      name: 'Integration Test Event',
      date: new Date('2026-05-01'),
      location: 'Ambato',
      category: 'ROAD',
    });

    const saved = await repository.save(event);

    expect(saved.id).toBe(event.id);
    expect(saved.name).toBe('Integration Test Event');
    expect(saved.status).toBe('DRAFT');

    // Verify in database
    const inDb = await prisma.event.findUnique({
      where: { id: event.id },
    });
    expect(inDb).not.toBeNull();
    expect(inDb!.name).toBe('Integration Test Event');
  });

  it('should update existing event', async () => {
    const event = Event.create({
      name: 'Original Name',
      date: new Date('2026-05-01'),
      location: null,
      category: 'ROAD',
    });

    await repository.save(event);

    // Modify and save again
    event.name = 'Updated Name';
    await repository.save(event);

    const updated = await repository.findById(event.id);
    expect(updated!.name).toBe('Updated Name');
  });
});
```

### Find Operations

```typescript
describe('findById', () => {
  it('should return event when exists', async () => {
    const event = Event.create({
      name: 'Test Event',
      date: new Date('2026-05-01'),
      location: 'Ambato',
      category: 'ROAD',
    });
    await repository.save(event);

    const found = await repository.findById(event.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(event.id);
    expect(found).toBeInstanceOf(Event);
  });

  it('should return null when not exists', async () => {
    const found = await repository.findById('non-existent-id');
    expect(found).toBeNull();
  });
});
```

### Query with Filters

```typescript
describe('getEventsList', () => {
  beforeEach(async () => {
    // Seed test data
    await Promise.all([
      repository.save(createEvent({ name: 'Event A', status: 'DRAFT' })),
      repository.save(createEvent({ name: 'Event B', status: 'PROCESSING' })),
      repository.save(createEvent({ name: 'Event C', status: 'DRAFT' })),
    ]);
  });

  it('should filter by status', async () => {
    const readRepository = module.get(EventReadRepository);

    const results = await readRepository.getEventsList({
      status: 'DRAFT',
      page: 1,
      limit: 10,
    });

    expect(results).toHaveLength(2);
    expect(results.every(e => e.status === 'DRAFT')).toBe(true);
  });

  it('should paginate results', async () => {
    const readRepository = module.get(EventReadRepository);

    const page1 = await readRepository.getEventsList({
      page: 1,
      limit: 2,
    });

    const page2 = await readRepository.getEventsList({
      page: 2,
      limit: 2,
    });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
  });

  it('should search by name', async () => {
    const readRepository = module.get(EventReadRepository);

    const results = await readRepository.getEventsList({
      search: 'Event A',
      page: 1,
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Event A');
  });
});
```

---

## Test Database

Use separate database for tests:

```env
# .env.test
DATABASE_URL="postgresql://user:password@localhost:5432/cycling_photos_test"
```

Run migrations before tests:
```bash
NODE_ENV=test npx prisma migrate deploy
```

---

## Cleanup Strategies

### Delete All (Simple)

```typescript
beforeEach(async () => {
  await prisma.photo.deleteMany();
  await prisma.event.deleteMany();
});
```

### Transaction Rollback (Fast)

```typescript
let transaction: PrismaClient;

beforeEach(async () => {
  transaction = await prisma.$transaction();
});

afterEach(async () => {
  await transaction.$rollback();
});
```

---

## Test Helpers

```typescript
// test/helpers/event.helper.ts
export function createEvent(overrides: Partial<CreateEventData> = {}): Event {
  return Event.create({
    name: overrides.name ?? 'Test Event',
    date: overrides.date ?? new Date('2026-05-01'),
    location: overrides.location ?? null,
    category: overrides.category ?? 'ROAD',
    ...overrides,
  });
}
```

---

## See Also

- `testing/test-guidelines.md` - General guidelines
- `testing/unit-tests.md` - Unit test patterns
- `testing/e2e-tests.md` - E2E patterns
- `infrastructure/prisma-setup.md` - Database setup
