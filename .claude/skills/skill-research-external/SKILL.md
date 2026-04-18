---
name: research-external
description: >
  Research external libraries and APIs using Context7 MCP.
  MANDATORY before implementing features that use external technologies.
---

# Research External

**Primary Tool:** Context7 MCP for library documentation

## When to Use

- **ALWAYS** before implementing with external libraries
- When plan-task identifies technologies (Prisma, NestJS, etc.)
- When encountering unfamiliar APIs
- When version-specific behavior matters

## Process

### 1. Check Research Cache First

```bash
# Before researching, check if we already have cached info
cat .claude/ledger/research/{technology}.md
```

If cache exists AND version matches → use cached info, skip research.

### 2. Use Context7 MCP

**This is the primary research method.** Context7 provides up-to-date library documentation.

```
Context7 queries:
- "Prisma 7 schema syntax generator client"
- "NestJS 11 module configuration providers"
- "class-validator decorator options"
- "BullMQ queue processor patterns"
```

**Query tips:**
- Include version number
- Be specific about the feature/API
- Search for examples, not just reference

### 3. Document Findings

Save to `.claude/ledger/research/{technology}.md`:

```markdown
# {Technology} Research Cache

**Version:** {version}
**Updated:** {date}
**Source:** Context7 MCP

## Key APIs Used

### {Feature 1}
```typescript
// Example from docs
```

**Notes:**
- Important gotcha 1
- Version-specific behavior

### {Feature 2}
...

## Integration Notes

- How it works with NestJS
- Required configuration
- Common patterns

## Gotchas

1. Issue 1 and solution
2. Issue 2 and solution
```

## Technologies We Use (Reference)

| Technology | Version | Key Areas to Research |
|------------|---------|----------------------|
| Prisma | 7.x | Schema syntax, client generation, migrations, adapters |
| NestJS | 11.x | Modules, providers, dependency injection |
| BullMQ | 5.x | Queues, workers, job options, events |
| class-validator | 0.14.x | Decorators, custom validators, groups |
| class-transformer | 0.5.x | Decorators, transformation options |
| Socket.io | 4.x | Gateway, namespaces, rooms | ⚠️ Not yet implemented |

## When Context7 Isn't Enough

If Context7 doesn't have the info:

1. Check official docs URL (save URL for reference)
2. Check GitHub repo issues/discussions
3. Document source in research cache

## Critical Rules

1. **NEVER assume API syntax** - always verify with Context7
2. **ALWAYS check version** - APIs change between versions
3. **ALWAYS save to research cache** - avoid repeated lookups
4. **ALWAYS note gotchas** - save time for future tasks

## Output

Research produces:
- Updated `.claude/ledger/research/{technology}.md`
- Specific code examples ready to use
- Known gotchas documented
