# Prisma Setup

## File Structure

```
prisma/
├── schema.prisma
└── migrations/

src/shared/infrastructure/prisma/
├── prisma.service.ts
└── prisma.module.ts
```

---

## Schema Example

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Event {
  id               String   @id @default(uuid())
  name             String
  event_date       DateTime
  location         String?
  category         String
  status           String   @default("DRAFT")
  total_photos     Int      @default(0)
  processed_photos Int      @default(0)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  photos           Photo[]

  @@index([status])
  @@index([event_date])
  @@map("events")
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Model name | PascalCase | `DetectedCyclist` |
| Table name | snake_case via @@map | `@@map("detected_cyclists")` |
| Column name | snake_case | `plate_number` |
| Foreign key | `{table}_id` | `event_id` |

---

## PrismaService

```typescript
// shared/infrastructure/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### PrismaModule

```typescript
// shared/infrastructure/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## Commands

```bash
# Generate client after schema changes
npx prisma generate

# Create migration
npx prisma migrate dev --name descriptive-name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Format schema
npx prisma format
```

---

## Repository Usage

Repositories use Mappers for conversion (see `patterns/repositories.md`):

```typescript
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
}
```

---

## Transactions

```typescript
async saveEventWithPhotos(event: Event, photos: Photo[]): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    await tx.event.create({ 
      data: EventMapper.toPersistence(event) 
    });
    
    await tx.photo.createMany({
      data: photos.map(PhotoMapper.toPersistence),
    });
  });
}
```

---

## Query Optimization

### Select Only Needed Fields

```typescript
// GOOD: Specific fields
const events = await this.prisma.event.findMany({
  select: {
    id: true,
    name: true,
    status: true,
  },
});

// BAD: Fetches everything
const events = await this.prisma.event.findMany();
```

### Use Indexes

```prisma
model Photo {
  id        String @id @default(uuid())
  event_id  String
  status    String

  event     Event  @relation(fields: [event_id], references: [id])

  @@index([event_id])
  @@index([status])
  @@map("photos")
}
```

---

## Error Handling

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

try {
  await this.prisma.event.create({ data });
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw AppException.businessRule('event.already_exists');
    }
    if (error.code === 'P2025') {
      throw AppException.notFound('event', id);
    }
  }
  throw error;
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| P2002 | Unique constraint violation |
| P2025 | Record not found |
| P2003 | Foreign key constraint |
| P2014 | Required relation missing |

---

## Environment

```env
# .env.development
DATABASE_URL="postgresql://user:password@localhost:5432/cycling_photos_dev"

# .env.test
DATABASE_URL="postgresql://user:password@localhost:5432/cycling_photos_test"

# .env.production
DATABASE_URL="postgresql://user:password@prod-host:5432/cycling_photos"
```

---

## See Also

- `patterns/repositories.md` - Repository and Mapper patterns
- `structure/module-setup.md` - PrismaModule registration
- `infrastructure/env-config.md` - Environment variables
