# Naming Conventions

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `{name}.entity.ts` | `event.entity.ts` |
| Value Object | `{name}.vo.ts` | `event-status.vo.ts` |
| Command | `{verb}-{noun}.command.ts` | `create-event.command.ts` |
| Query | `get-{noun}.query.ts` | `get-events-list.query.ts` |
| Handler | `{name}.handler.ts` | `create-event.handler.ts` |
| DTO | `{name}.dto.ts` | `create-event.dto.ts` |
| Projection | `{name}.projection.ts` | `event-list.projection.ts` |
| Repository | `{entity}-{write/read}.repository.ts` | `event-write.repository.ts` |
| Mapper | `{entity}.mapper.ts` | `event.mapper.ts` |
| Adapter | `{service}.adapter.ts` | `roboflow.adapter.ts` |
| Controller | `{plural}.controller.ts` | `events.controller.ts` |
| Module | `{name}.module.ts` | `events.module.ts` |
| Processor | `{name}.processor.ts` | `photo-processing.processor.ts` |
| Gateway | `{name}.gateway.ts` | `progress.gateway.ts` |
| Filter | `{name}.filter.ts` | `global-exception.filter.ts` |
| Interceptor | `{name}.interceptor.ts` | `response.interceptor.ts` |
| Middleware | `{name}.middleware.ts` | `request-id.middleware.ts` |
| Unit test | `{name}.spec.ts` | `event.entity.spec.ts` |
| Integration test | `{name}.integration.spec.ts` | `event-write.repository.integration.spec.ts` |
| E2E test | `{name}.e2e-spec.ts` | `events.e2e-spec.ts` |

---

## Class Naming

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `{Name}` | `Event`, `Photo` |
| Value Object | `{Name}` | `EventStatus`, `PlateNumber` |
| Command | `{Verb}{Noun}Command` | `CreateEventCommand` |
| Query | `Get{Noun}Query` | `GetEventsListQuery` |
| Handler | `{Command/Query}Handler` | `CreateEventHandler` |
| DTO | `{Verb}{Noun}Dto` | `CreateEventDto` |
| Projection | `{Noun}Projection` | `EventListProjection` |
| Repository | `{Entity}{Write/Read}Repository` | `EventWriteRepository` |
| Mapper | `{Entity}Mapper` | `EventMapper` |
| Adapter | `{Service}Adapter` | `RoboflowAdapter` |
| Controller | `{Plural}Controller` | `EventsController` |
| Module | `{Name}Module` | `EventsModule` |

---

## Method Naming

### Entity Methods

| Type | Pattern | Example |
|------|---------|---------|
| Factory | `create()` | `Event.create(data)` |
| Reconstitution | `fromPersistence()` | `Event.fromPersistence(data)` |
| Guard | `can{Action}()` | `canUploadPhotos()` |
| Mutation | `{verb}()` | `startProcessing()` |
| Query | `is{State}()`, `has{Thing}()` | `isCompleted()`, `hasPhotos()` |

### Repository Methods

| Type | Pattern | Example |
|------|---------|---------|
| Create/Update | `save()` | `save(entity)` |
| Find one | `findById()` | `findById(id)` |
| Find many | `get{Noun}List()` | `getEventsList(filters)` |
| Delete | `delete()` | `delete(id)` |

### Mapper Methods

| Type | Pattern | Example |
|------|---------|---------|
| To persistence | `toPersistence()` | `EventMapper.toPersistence(entity)` |
| To entity | `toEntity()` | `EventMapper.toEntity(record)` |
| To projection | `to{Name}Projection()` | `EventMapper.toListProjection(record)` |

---

## Variable Naming

```typescript
// Entities
const event = Event.create(...);
const photo = await repository.findById(id);

// Collections
const events = await repository.getEventsList(filters);
const photos = await repository.findByEventId(eventId);

// DTOs/Projections
const dto = new CreateEventDto();
const projection = EventMapper.toListProjection(record);

// Primitives - descriptive names
const eventId = command.eventId;
const totalPhotos = event.totalPhotos;
const isProcessing = event.status === 'PROCESSING';
```

---

## Database Naming

| Element | Convention | Example |
|---------|------------|---------|
| Table | snake_case, plural | `events`, `detected_cyclists` |
| Column | snake_case | `plate_number`, `created_at` |
| Foreign key | `{table}_id` | `event_id`, `photo_id` |
| Index | `idx_{table}_{columns}` | `idx_photos_event_id` |
| Unique | `uq_{table}_{columns}` | `uq_users_email` |

Prisma model uses PascalCase, mapped to snake_case:

```prisma
model DetectedCyclist {
  id           String @id
  plate_number Int
  
  @@map("detected_cyclists")
}
```

---

## Folder Naming

All folders use kebab-case:

```
src/
├── modules/
│   ├── events/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   └── value-objects/
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   └── create-event/
│   │   │   └── queries/
│   │   │       └── get-events-list/
│   │   └── infrastructure/
│   │       ├── repositories/
│   │       └── mappers/
```

---

## See Also

- `structure/feature-sliced.md` - Folder structure
- `conventions/git.md` - Commit message conventions
