# Structure Checklist

Use when creating new module or feature.

## Module Structure

- [ ] Module folder created: `src/modules/{name}/`
- [ ] domain/ folder exists
  - [ ] entities/ (with `index.ts` barrel)
  - [ ] value-objects/ (if needed)
  - [ ] ports/ (with `index.ts` barrel)
- [ ] application/ folder exists
  - [ ] commands/ (with `index.ts` barrel)
  - [ ] queries/ (with `index.ts` barrel)
  - [ ] projections/ (with `index.ts` barrel)
- [ ] infrastructure/ folder exists
  - [ ] repositories/
  - [ ] mappers/
  - [ ] adapters/ (if external services)
  - [ ] processors/ (if BullMQ)
- [ ] presentation/ folder exists
  - [ ] controllers/
- [ ] {name}.module.ts created
- [ ] Barrel files (`index.ts`) at each layer exporting public API

## Feature Structure (Command)

```
application/commands/{feature}/
├── {feature}.dto.ts          # Not needed for delete (ID from route param)
├── {feature}.command.ts
├── {feature}.handler.ts
└── {feature}.handler.spec.ts  # Co-located with handler
```

- [ ] Folder named with verb-noun (e.g., `create-event/`)
- [ ] Command + Handler files present
- [ ] DTO present (except delete — ID from route param)
- [ ] Handler spec co-located in same folder
- [ ] Files follow naming pattern

## Feature Structure (Query)

```
application/queries/{feature}/
├── {feature}.dto.ts           # Only if query has params (e.g., list with pagination)
├── {feature}.query.ts
└── {feature}.handler.ts

application/projections/
└── {noun}.projection.ts       # Separate from queries/
```

- [ ] Folder named with get-noun (e.g., `get-events-list/`)
- [ ] Query + Handler files present
- [ ] DTO only if query accepts params (detail query with just ID has no DTO)
- [ ] Projection in `projections/` folder (not inside query folder)

## Registration

- [ ] Module registered in app.module.ts
- [ ] Handlers grouped in const arrays: `const CommandHandlers = [...], QueryHandlers = [...]`
- [ ] Handlers spread into module providers: `...CommandHandlers, ...QueryHandlers`
- [ ] Repositories as `{ provide: SYMBOL_TOKEN, useClass: RepoClass }` (token-based DI)
- [ ] Repositories exported if needed by other modules

---

## See Also

- `structure/feature-sliced.md` - Full structure
- `structure/module-setup.md` - Module configuration
