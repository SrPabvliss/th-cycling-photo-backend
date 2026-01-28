# Repository Pattern

## Overview

Repositories handle persistence. Separated into Write (commands) and Read (queries) to prevent overfetching. Mapping logic lives in dedicated Mapper classes.

## File Structure

```
modules/{domain}/infrastructure/
├── repositories/
│   ├── {entity}-write.repository.ts    # For commands
│   └── {entity}-read.repository.ts     # For queries
└── mappers/
    └── {entity}.mapper.ts              # Entity ↔ Persistence mapping
```

---

## Mapper

Dedicated class for all mapping logic. Used by both Write and Read repositories.

```typescript
import { Event } from '@/modules/events/domain/entities/event.entity';
import { EventListProjection } from '@/modules/events/application/projections/event-list.projection';
import { EventDetailProjection } from '@/modules/events/application/projections/event-detail.projection';
import { Prisma, Event as PrismaEvent } from '@prisma/client';

export class EventMapper {
  // ─────────────────────────────────────────────
  // Write Repository mappings
  // ─────────────────────────────────────────────

  static toPersistence(entity: Event): Prisma.EventCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      date: entity.date,
      location: entity.location,
      category: entity.category,
      status: entity.status,
      total_photos: entity.totalPhotos,
      processed_photos: entity.processedPhotos,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  static toEntity(record: PrismaEvent): Event {
    return Event.fromPersistence({
      id: record.id,
      name: record.name,
      date: record.date,
      location: record.location,
      category: record.category,
      status: record.status,
      totalPhotos: record.total_photos,
      processedPhotos: record.processed_photos,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  }

  // ─────────────────────────────────────────────
  // Read Repository mappings (Projections)
  // ─────────────────────────────────────────────

  static toListProjection(record: {
    id: string;
    name: string;
    date: Date;
    location: string | null;
    status: string;
    total_photos: number;
    processed_photos: number;
  }): EventListProjection {
    return {
      id: record.id,
      name: record.name,
      date: record.date,
      location: record.location,
      status: record.status,
      totalPhotos: record.total_photos,
      processedPhotos: record.processed_photos,
    };
  }

  static toDetailProjection(record: {
    id: string;
    name: string;
    date: Date;
    location: string | null;
    category: string;
    status: string;
    total_photos: number;
    processed_photos: number;
    created_at: Date;
    _count: { photos: number };
  }): EventDetailProjection {
    return {
      id: record.id,
      name: record.name,
      date: record.date,
      location: record.location,
      category: record.category,
      status: record.status,
      totalPhotos: record.total_photos,
      processedPhotos: record.processed_photos,
      createdAt: record.created_at,
      photoCount: record._count.photos,
    };
  }
}
```

**Mapper Rules:**
- All static methods
- No dependencies (pure functions)
- Handles snake_case ↔ camelCase conversion
- One mapper per aggregate root

---

## Write Repository

Handles entity persistence for commands. Uses Mapper for conversions.

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { Event } from '@/modules/events/domain/entities/event.entity';
import { EventMapper } from '../mappers/event.mapper';

@Injectable()
export class EventWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(event: Event): Promise<Event> {
    const data = EventMapper.toPersistence(event);

    const saved = await this.prisma.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    });

    return EventMapper.toEntity(saved);
  }

  async findById(id: string): Promise<Event | null> {
    const record = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!record) return null;

    return EventMapper.toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({
      where: { id },
    });
  }
}
```

**Write Repository Rules:**
- Returns full Entity (for further operations)
- Uses `upsert` for save (create or update)
- Delegates mapping to Mapper class
- NO business logic

---

## Read Repository

Handles queries with projections. Uses Mapper for conversions.

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { EventListProjection } from '@/modules/events/application/projections/event-list.projection';
import { EventDetailProjection } from '@/modules/events/application/projections/event-detail.projection';
import { EventMapper } from '../mappers/event.mapper';

@Injectable()
export class EventReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getEventsList(filters: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page: number;
    limit: number;
  }): Promise<EventListProjection[]> {
    const skip = (filters.page - 1) * filters.limit;

    const events = await this.prisma.event.findMany({
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        status: true,
        total_photos: true,
        processed_photos: true,
      },
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.dateFrom && { date: { gte: filters.dateFrom } }),
        ...(filters.dateTo && { date: { lte: filters.dateTo } }),
        ...(filters.search && {
          name: { contains: filters.search, mode: 'insensitive' },
        }),
      },
      orderBy: { date: 'desc' },
      skip,
      take: filters.limit,
    });

    return events.map(EventMapper.toListProjection);
  }

  async getEventDetail(id: string): Promise<EventDetailProjection | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        category: true,
        status: true,
        total_photos: true,
        processed_photos: true,
        created_at: true,
        _count: {
          select: { photos: true },
        },
      },
    });

    if (!event) return null;

    return EventMapper.toDetailProjection(event);
  }
}
```

**Read Repository Rules:**
- Returns Projection, NOT Entity
- Uses `select` to fetch only needed fields
- Delegates mapping to Mapper class
- One method per query use case
- Pagination built-in

---

## Anti-Patterns

❌ **Overfetching with include:**
```typescript
// BAD: Fetches everything
return this.prisma.event.findMany({
  include: {
    photos: {
      include: {
        detected_cyclists: true,
        detected_colors: true,
      },
    },
  },
});
```

❌ **Business logic in repository:**
```typescript
// BAD: Logic belongs in Entity
async save(event: Event) {
  if (event.status === 'COMPLETED') {
    await this.notificationService.send(...);
  }
}
```

❌ **Mapping inside repository:**
```typescript
// BAD: Mapping belongs in Mapper class
async save(event: Event) {
  const data = {
    id: event.id,
    name: event.name,
    // ... inline mapping
  };
}
```

✅ **Correct: Delegate to Mapper:**
```typescript
// GOOD: Single responsibility
const data = EventMapper.toPersistence(event);
return EventMapper.toEntity(saved);
```

---

## Port Interface (Optional)

For strict domain isolation, define ports:

```typescript
// domain/ports/event-repository.port.ts
export interface IEventWriteRepository {
  save(event: Event): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  delete(id: string): Promise<void>;
}

export interface IEventReadRepository {
  getEventsList(filters: EventListFilters): Promise<EventListProjection[]>;
  getEventDetail(id: string): Promise<EventDetailProjection | null>;
}
```

Then implement in infrastructure and inject via interface token.

---

## Testing Repositories

### Unit Test (mocking Prisma)

```typescript
describe('EventWriteRepository', () => {
  let repository: EventWriteRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      event: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        EventWriteRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get(EventWriteRepository);
    prisma = module.get(PrismaService);
  });

  it('should save and return entity', async () => {
    const event = Event.create({ ... });
    prisma.event.upsert.mockResolvedValue({ ... });

    const result = await repository.save(event);

    expect(result).toBeInstanceOf(Event);
    expect(prisma.event.upsert).toHaveBeenCalled();
  });
});
```

### Integration Test (with real DB)

```typescript
describe('EventWriteRepository (Integration)', () => {
  let repository: EventWriteRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [EventWriteRepository],
    }).compile();

    repository = module.get(EventWriteRepository);
    prisma = module.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.event.deleteMany();
  });

  it('should persist and retrieve event', async () => {
    const event = Event.create({
      name: 'Test Event',
      date: new Date('2026-05-01'),
      location: 'Ambato',
      category: 'ROAD',
    });

    const saved = await repository.save(event);
    const found = await repository.findById(saved.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test Event');
  });
});
```

---

## See Also

- `patterns/cqrs.md` - How repositories fit in command/query flow
- `patterns/entities.md` - Entity and fromPersistence() method
- `infrastructure/prisma-setup.md` - PrismaService configuration
- `testing/integration-tests.md` - Repository testing patterns
