---
name: plan-task
description: >
  Plan and break down tasks into implementation steps.
  Use when starting a new feature, story, or technical task.
---

# Plan Task

Plan implementation approach before writing code.

## When to Use

- Starting a new user story or feature
- Breaking down complex tasks
- Understanding where files should go
- Estimating scope and complexity

## Process

1. **Understand the requirement** - What needs to be built?
2. **Identify the domain** - Which module does this belong to?
3. **Define the components** - Commands, queries, entities, etc.
4. **Plan file structure** - Where each file goes
5. **List implementation steps** - Ordered tasks

## Required Context

Read these before planning:

- `contexts/structure/feature-sliced.md` - Folder structure and layer rules
- `contexts/structure/module-setup.md` - NestJS module configuration
- `contexts/patterns/cqrs.md` - Command/Query patterns
- `contexts/checklists/structure.md` - Structure verification checklist

## Output Format

```markdown
## Task: [Task Name]

### Analysis
- Domain: [module name]
- Type: [Command/Query/Both]
- Complexity: [S/M/L/XL]

### Components Needed
- [ ] Entity: `{name}.entity.ts`
- [ ] Command: `{name}.command.ts`
- [ ] Handler: `{name}.handler.ts`
- [ ] Repository: `{name}-write.repository.ts`
- [ ] Mapper: `{name}.mapper.ts`
- [ ] Controller endpoint

### File Structure
```
src/modules/{domain}/
├── domain/entities/{name}.entity.ts
├── application/commands/{feature}/
│   ├── {feature}.dto.ts
│   ├── {feature}.command.ts
│   └── {feature}.handler.ts
└── infrastructure/
    ├── repositories/{name}-write.repository.ts
    └── mappers/{name}.mapper.ts
```

### Implementation Steps
1. [ ] Create entity with validations
2. [ ] Create DTO with class-validator
3. [ ] Create command and handler
4. [ ] Create repository and mapper
5. [ ] Add controller endpoint
6. [ ] Write unit tests
7. [ ] Register in module
```

## Tips

- Start with the domain (entity) before infrastructure
- Identify if it's a Command (write) or Query (read)
- Check if entity already exists
- Consider if new module is needed
