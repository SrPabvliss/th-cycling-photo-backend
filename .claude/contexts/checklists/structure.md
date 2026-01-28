# Structure Checklist

Use when creating new module or feature.

## Module Structure

- [ ] Module folder created: `src/modules/{name}/`
- [ ] domain/ folder exists
  - [ ] entities/
  - [ ] value-objects/ (if needed)
  - [ ] ports/ (if using interfaces)
- [ ] application/ folder exists
  - [ ] commands/
  - [ ] queries/
  - [ ] projections/
- [ ] infrastructure/ folder exists
  - [ ] repositories/
  - [ ] mappers/
  - [ ] adapters/ (if external services)
  - [ ] processors/ (if BullMQ)
- [ ] presentation/ folder exists
  - [ ] controllers/
- [ ] {name}.module.ts created

## Feature Structure (Command)

```
application/commands/{feature}/
├── {feature}.dto.ts
├── {feature}.command.ts
└── {feature}.handler.ts
```

- [ ] Folder named with verb-noun (e.g., `create-event/`)
- [ ] All 3 files present
- [ ] Files follow naming pattern

## Feature Structure (Query)

```
application/queries/{feature}/
├── {feature}.dto.ts
├── {feature}.query.ts
└── {feature}.handler.ts

application/projections/
└── {feature}.projection.ts
```

- [ ] Folder named with get-noun (e.g., `get-events-list/`)
- [ ] All files present
- [ ] Projection in projections/ folder

## Registration

- [ ] Module registered in app.module.ts
- [ ] Handlers in module providers
- [ ] Repositories in module providers
- [ ] Repositories exported if needed by other modules

---

## See Also

- `structure/feature-sliced.md` - Full structure
- `structure/module-setup.md` - Module configuration
