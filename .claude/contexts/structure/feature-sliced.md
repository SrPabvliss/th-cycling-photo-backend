# Feature-Sliced Architecture

## Overview

Modular structure organizing code by domain (feature), not by technical layer.

## Full Structure

```
src/
├── modules/                          # Domain modules
│   ├── events/
│   │   ├── domain/                   # Business logic
│   │   │   ├── entities/
│   │   │   │   └── event.entity.ts
│   │   │   ├── value-objects/
│   │   │   │   └── event-status.vo.ts
│   │   │   └── ports/                # Repository interfaces (optional)
│   │   │       └── event-repository.port.ts
│   │   │
│   │   ├── application/              # Use cases
│   │   │   ├── commands/
│   │   │   │   └── create-event/
│   │   │   │       ├── create-event.dto.ts
│   │   │   │       ├── create-event.command.ts
│   │   │   │       └── create-event.handler.ts
│   │   │   ├── queries/
│   │   │   │   └── get-events-list/
│   │   │   │       ├── get-events-list.dto.ts
│   │   │   │       ├── get-events-list.query.ts
│   │   │   │       └── get-events-list.handler.ts
│   │   │   └── projections/
│   │   │       ├── event-list.projection.ts
│   │   │       └── event-detail.projection.ts
│   │   │
│   │   ├── infrastructure/           # Technical implementations
│   │   │   ├── repositories/
│   │   │   │   ├── event-write.repository.ts
│   │   │   │   └── event-read.repository.ts
│   │   │   ├── mappers/
│   │   │   │   └── event.mapper.ts
│   │   │   ├── adapters/             # External services˜
│   │   │   │   └── roboflow.adapter.ts
│   │   │   └── processors/           # BullMQ workers
│   │   │       └── event-processing.processor.ts
│   │   │
│   │   ├── presentation/             # HTTP layer
│   │   │   ├── controllers/
│   │   │   │   └── events.controller.ts
│   │   │   └── dtos/                 # Response DTOs (if different from projections)
│   │   │
│   │   └── events.module.ts
│   │
│   ├── photos/
│   ├── processing/
│   └── storage/
│
├── shared/                           # Cross-cutting concerns
│   ├── domain/
│   │   └── exceptions/
│   │       └── app.exception.ts
│   ├── infrastructure/
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts
│   │   └── middleware/
│   │       └── request-id.middleware.ts
│   └── websockets/
│       └── progress.gateway.ts
│
└── app.module.ts
```

---

## Layer Rules

### domain/
- NO dependencies on other layers
- Pure TypeScript (no NestJS decorators except for DI)
- Contains: entities, value objects, domain exceptions, port interfaces

### application/
- Depends only on domain/
- Contains: commands, queries, handlers, projections
- One folder per use case

### infrastructure/
- Implements domain ports
- Contains: repositories, mappers, adapters (external services), processors
- Can depend on domain/ and application/

### presentation/
- HTTP concerns only
- Contains: controllers, request/response DTOs
- Thin layer, delegates to CommandBus/QueryBus

---

## Naming Rules

| Layer | Type | Pattern | Example |
|-------|------|---------|---------|
| domain | Entity | `{name}.entity.ts` | `event.entity.ts` |
| domain | Value Object | `{name}.vo.ts` | `event-status.vo.ts` |
| domain | Port | `{name}-repository.port.ts` | `event-repository.port.ts` |
| application | Command | `{verb}-{noun}.command.ts` | `create-event.command.ts` |
| application | Query | `get-{noun}.query.ts` | `get-events-list.query.ts` |
| application | Handler | `{command/query}.handler.ts` | `create-event.handler.ts` |
| application | Projection | `{name}.projection.ts` | `event-list.projection.ts` |
| infrastructure | Repository | `{entity}-{write/read}.repository.ts` | `event-write.repository.ts` |
| infrastructure | Mapper | `{entity}.mapper.ts` | `event.mapper.ts` |
| infrastructure | Adapter | `{service}.adapter.ts` | `roboflow.adapter.ts` |
| presentation | Controller | `{plural}.controller.ts` | `events.controller.ts` |

---

## Creating a New Module

```bash
# Create folder structure
mkdir -p src/modules/{module-name}/{domain,application,infrastructure,presentation}
mkdir -p src/modules/{module-name}/domain/{entities,value-objects,ports}
mkdir -p src/modules/{module-name}/application/{commands,queries,projections}
mkdir -p src/modules/{module-name}/infrastructure/{repositories,mappers,adapters}
mkdir -p src/modules/{module-name}/presentation/controllers

# Create module file
touch src/modules/{module-name}/{module-name}.module.ts
```

---

## Anti-Patterns

❌ **Technical-first structure:**
```
src/
├── controllers/      # BAD: Groups by technical layer
├── services/
├── repositories/
└── entities/
```

❌ **Mixed responsibilities:**
```
src/modules/events/
├── event.service.ts  # BAD: Service doing everything
└── event.controller.ts
```

❌ **Barrel exports abuse:**
```typescript
// src/modules/events/index.ts
export * from './domain/entities/event.entity';
export * from './application/commands/create-event/create-event.command';
// BAD: Re-exporting everything breaks encapsulation
```

✅ **Correct: Feature-first:**
```
src/modules/events/
├── domain/           # GOOD: Organized by layer within feature
├── application/
├── infrastructure/
└── presentation/
```

---

## shared/ Usage

Only for genuinely cross-cutting code:

**DO put in shared/:**
- Base exceptions (AppException)
- Global filters, interceptors, middleware
- PrismaService
- WebSocket gateways

**DON'T put in shared/:**
- Feature-specific code
- DTOs that belong to one module
- "Might be reused someday" code

---

## See Also

- `structure/module-setup.md` - NestJS module configuration
- `patterns/cqrs.md` - Command/Query organization
- `patterns/repositories.md` - Repository placement
