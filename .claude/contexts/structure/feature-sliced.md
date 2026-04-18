# Feature-Sliced Architecture

## Overview

Modular structure organizing code by domain (feature), not by technical layer.

## Full Structure

```
src/
├── app.module.ts
├── app.controller.ts
├── app.service.ts
├── main.ts
├── config/
│   ├── configuration.ts
│   └── env.validation.ts
├── generated/prisma/                 # Prisma-generated client (NEVER modify)
├── i18n/                             # Translation JSON files (en/, es/)
│
├── modules/                          # Domain modules
│   ├── events/
│   │   ├── domain/                   # Business logic
│   │   │   ├── entities/
│   │   │   │   ├── index.ts          # Barrel file
│   │   │   │   ├── event.entity.ts
│   │   │   │   └── event.entity.spec.ts
│   │   │   ├── value-objects/
│   │   │   │   └── event-status.vo.ts
│   │   │   └── ports/                # Repository interfaces (required for DI)
│   │   │       ├── index.ts
│   │   │       ├── event-read-repository.port.ts
│   │   │       └── event-write-repository.port.ts
│   │   │
│   │   ├── application/              # Use cases
│   │   │   ├── commands/
│   │   │   │   ├── index.ts          # Barrel file
│   │   │   │   ├── create-event/
│   │   │   │   │   ├── create-event.dto.ts
│   │   │   │   │   ├── create-event.command.ts
│   │   │   │   │   ├── create-event.handler.ts
│   │   │   │   │   └── create-event.handler.spec.ts
│   │   │   │   ├── update-event/
│   │   │   │   │   ├── update-event.dto.ts
│   │   │   │   │   ├── update-event.command.ts
│   │   │   │   │   └── update-event.handler.ts
│   │   │   │   └── delete-event/
│   │   │   │       ├── delete-event.command.ts
│   │   │   │       ├── delete-event.handler.ts
│   │   │   │       └── delete-event.handler.spec.ts
│   │   │   ├── queries/
│   │   │   │   ├── index.ts          # Barrel file
│   │   │   │   ├── get-events-list/
│   │   │   │   │   ├── get-events-list.dto.ts
│   │   │   │   │   ├── get-events-list.query.ts
│   │   │   │   │   └── get-events-list.handler.ts
│   │   │   │   └── get-event-detail/
│   │   │   │       ├── get-event-detail.query.ts
│   │   │   │       └── get-event-detail.handler.ts
│   │   │   └── projections/
│   │   │       ├── index.ts          # Barrel file
│   │   │       ├── event-list.projection.ts
│   │   │       └── event-detail.projection.ts
│   │   │
│   │   ├── infrastructure/           # Technical implementations
│   │   │   ├── repositories/
│   │   │   │   ├── event-write.repository.ts
│   │   │   │   └── event-read.repository.ts
│   │   │   └── mappers/
│   │   │       └── event.mapper.ts
│   │   │   # ⚠️ Future: adapters/ (external services), processors/ (BullMQ workers)
│   │   │
│   │   ├── presentation/             # HTTP layer
│   │   │   └── controllers/
│   │   │       └── events.controller.ts
│   │   │
│   │   └── events.module.ts
│   │
│   # ⚠️ Future modules: photos/, processing/, storage/
│
├── shared/                           # Cross-cutting concerns
│   ├── domain/
│   │   ├── index.ts                  # Barrel file
│   │   ├── audit-fields.ts
│   │   └── exceptions/
│   │       └── app.exception.ts
│   ├── application/
│   │   ├── index.ts                  # Barrel file
│   │   ├── pagination.ts
│   │   └── projections/
│   │       └── entity-id.projection.ts
│   ├── http/
│   │   ├── index.ts                  # Barrel file
│   │   ├── decorators/
│   │   │   └── success-message.decorator.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts
│   │   ├── interfaces/
│   │   │   ├── api-response.interface.ts
│   │   │   └── express.d.ts
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts
│   │   └── swagger/
│   │       ├── api-response.schema.ts
│   │       ├── api-envelope-response.decorator.ts
│   │       └── swagger-i18n.transformer.ts
│   └── infrastructure/
│       ├── index.ts                  # Barrel file
│       └── prisma/
│           ├── prisma.service.ts
│           └── prisma.module.ts
│   # ⚠️ Future: websockets/ (progress.gateway.ts)
│
```

> **Barrel files (index.ts)** exist at each layer boundary (9+ files). They enable clean alias imports like `from '@events/domain/ports'` instead of deep relative paths.

---

## Layer Rules

### domain/
- Pure TypeScript (no NestJS decorators except for DI)
- Contains: entities, value objects, domain exceptions, port interfaces
- **Trade-off:** Ports import from `application/` (projections, Pagination) to keep repository interfaces properly typed. This is a known architectural compromise — domain depends on application for return types only.

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
- Contains: controllers (DTOs live with commands/queries in `application/`, not here)
- Thin layer, delegates to CommandBus/QueryBus

---

## Naming Rules

| Layer | Type | Pattern | Example |
|-------|------|---------|---------|
| domain | Entity | `{name}.entity.ts` | `event.entity.ts` |
| domain | Value Object | `{name}.vo.ts` | `event-status.vo.ts` |
| domain | Port | `{name}-{read\|write}-repository.port.ts` | `event-read-repository.port.ts` |
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
- Base exceptions (AppException), AuditFields
- Global filters, interceptors, middleware (in `shared/http/`)
- Swagger decorators and i18n transformer (in `shared/http/swagger/`)
- PrismaService (in `shared/infrastructure/`)
- Pagination, EntityIdProjection (in `shared/application/`)

**DON'T put in shared/:**
- Feature-specific code
- DTOs that belong to one module
- "Might be reused someday" code

---

## See Also

- `structure/module-setup.md` - NestJS module configuration
- `patterns/cqrs.md` - Command/Query organization
- `patterns/repositories.md` - Repository placement
