# Events Module

## Overview

Reference CQRS module for managing cycling events. All future modules (photos, processing, storage) follow this pattern.

## Architecture

```
events/
├── domain/
│   ├── entities/          # Event entity with factory + validations
│   └── value-objects/     # EventStatus const object
├── application/
│   ├── commands/          # CreateEvent, UpdateEvent, DeleteEvent (write side)
│   ├── queries/           # GetEventsList, GetEventDetail (read side)
│   └── projections/       # EventList, EventDetail projections (query DTOs)
├── infrastructure/
│   ├── mappers/           # Exported functions (entity ↔ Prisma)
│   └── repositories/      # Write + Read repositories
└── presentation/
    └── controllers/       # REST endpoints via CommandBus/QueryBus
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/events | Create a new event |
| PATCH | /api/v1/events/:id | Update an event |
| DELETE | /api/v1/events/:id | Delete an event |
| GET | /api/v1/events/:id | Get event detail |
| GET | /api/v1/events | List events (paginated) |

## Domain Rules

1. Event name must be between 3 and 200 characters
2. Event date cannot be in the past (compared against start of today)
3. New events are always created with `draft` status
4. Location is optional (nullable)
5. Update validates the same rules as create for changed fields

## CQRS Flow

**Command (write):** Controller → CommandBus → Handler → Entity → EventWriteRepository

**Query (read):** Controller → QueryBus → Handler → EventReadRepository → Projection
