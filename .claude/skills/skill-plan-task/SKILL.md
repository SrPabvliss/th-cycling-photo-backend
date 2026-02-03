---
name: plan-task
description: >
  Orchestrator skill - plans tasks, assigns skills, defines checkpoints.
  MUST be invoked at the start of every ticket. Coordinates the entire workflow.
---

# Plan Task (Orchestrator)

**Role:** This skill orchestrates the entire development workflow. It reads tickets, researches technologies, creates structured plans with skill assignments, and defines checkpoints.

## When to Use

- Starting ANY new ticket from Jira
- Re-planning after a failed review
- Breaking down complex tasks

## Mandatory Process

### Phase 0: Jira Transition
```
→ skill:manage-git
```
1. Read ticket details from Jira MCP
2. **Transition ticket to "In Progress"**
3. Create/update session ledger: `.claude/ledger/sessions/{TICKET-ID}.md`

### Phase 1: Technology Research (MANDATORY)
```
→ skill:research-external
```
**BEFORE planning implementation, ALWAYS research with Context7 MCP:**

1. Identify technologies involved (e.g., Prisma, NestJS, BullMQ)
2. Use Context7 to fetch current documentation for each
3. Note version-specific APIs and patterns
4. Save findings to `.claude/ledger/research/{technology}.md`

**Example:**
```
Technologies detected: Prisma 7, NestJS 11, class-validator
→ Context7: Prisma 7 schema syntax, migrations
→ Context7: NestJS 11 module configuration
→ Save research cache
```

**NEVER skip this phase.** Outdated implementations are worse than slow implementations.

### Phase 2: Context Loading
Read relevant local contexts before planning:

| Context Type | Files |
|--------------|-------|
| Structure | `contexts/structure/feature-sliced.md`, `module-setup.md` |
| Patterns | `contexts/patterns/cqrs.md`, `entities.md`, `repositories.md` |
| Conventions | `contexts/conventions/naming.md`, `validations.md` |
| Project Docs | `.claude/project_docs/*.md` (ticket-specific) |

### Phase 3: Analysis & Planning
1. **Understand the requirement** - What needs to be built?
2. **Identify the domain** - Which module does this belong to?
3. **Define the components** - Commands, queries, entities, etc.
4. **Check existing code** - What already exists that can be reused?
5. **Plan file structure** - Where each file goes
6. **List implementation steps** - With skill assignments and checkpoints

## Output Format

```markdown
## Plan: {TICKET-ID}

### Prerequisites
- [x] Ticket transitioned to "In Progress" → skill:manage-git
- [x] Research completed:
  - Prisma 7: `.claude/ledger/research/prisma.md`
  - NestJS 11: `.claude/ledger/research/nestjs.md`
- [x] Contexts loaded: patterns/cqrs.md, conventions/naming.md

### Analysis
- **Domain:** {module name}
- **Type:** Command / Query / Both
- **Complexity:** S / M / L / XL
- **Technologies:** {list with versions}

### Required Components
- [ ] Entity: `{name}.entity.ts`
- [ ] Command: `{name}.command.ts`
- [ ] Handler: `{name}.handler.ts`
- [ ] Repository: `{name}-write.repository.ts`

### Tasks

#### 1. Create module structure
```
→ skill:implement-feature
Contexts: structure/module-setup.md
```
- [ ] Create folders according to feature-sliced
- [ ] Register module in app.module.ts
- **Checkpoint:** `git commit -m "feat({domain}): scaffold module structure"`

#### 2. Implement Entity
```
→ skill:implement-feature
Contexts: patterns/entities.md
Research: prisma.md (schema syntax)
```
- [ ] Create entity with factory method
- [ ] Add domain validations
- **Checkpoint:** `git commit -m "feat({domain}): add {Entity} entity"`

#### 3. Implement Command/Handler
```
→ skill:implement-feature
Contexts: patterns/cqrs.md
```
- [ ] Create DTO with class-validator
- [ ] Create Command
- [ ] Create Handler with repository injection
- **Checkpoint:** `git commit -m "feat({domain}): add {Feature}Command"`

#### 4. Implement Repository
```
→ skill:implement-feature
Contexts: patterns/repositories.md
Research: prisma.md (client usage)
```
- [ ] Create Write Repository
- [ ] Create Mapper Entity ↔ Prisma
- **Checkpoint:** `git commit -m "feat({domain}): add {Entity} repository"`

#### 5. Tests
```
→ skill:write-tests
Contexts: testing/test-guidelines.md
```
- [ ] Unit tests for handler (mock repository)
- [ ] Integration test for repository (test DB)
- **Checkpoint:** `git commit -m "test({domain}): add tests for {Feature}"`

#### 6. Documentation
```
→ skill:document-code
Contexts: conventions/documentation.md
```
- [ ] JSDoc on public methods
- [ ] Update module README if new

#### 7. Internal review
```
→ skill:review-code
Contexts: checklists/implementation.md
```
- [ ] Verify feature-sliced structure
- [ ] Verify CQRS patterns
- [ ] Verify naming conventions

### Post-tasks (MANDATORY)
- [ ] Update ledger: `.claude/ledger/sessions/{TICKET-ID}.md`
- [ ] Create PR → skill:manage-git
- [ ] Transition Jira to "Ready for Review" → skill:manage-git
```

## Critical Rules

1. **ALWAYS** use Context7 MCP for external technology documentation
2. **ALWAYS** indicate `→ skill:xxx` for each task group
3. **ALWAYS** define commit checkpoints
4. **ALWAYS** update ledger when finished
5. **ALWAYS** load relevant local contexts before implementing
6. **NEVER** assume APIs or syntax - verify with Context7 first

## In Case of Review Failure

If `skill:review-code` detects issues:

1. Increment `review_attempts` in ledger
2. Analyze feedback
3. Re-plan ONLY the affected tasks
4. If 3rd attempt fails → create PR with documented issues for manual review

