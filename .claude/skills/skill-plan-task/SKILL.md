---
name: plan-task
description: >
  Create implementation plans based on research and existing code review.
  REQUIRES research-external to run first. Never plan without research cache.
---

# Plan Task

**Role:** Create informed implementation plans. Does NOT implement, only plans.

## When to Use

- After `skill:research-external` has populated the research cache
- Starting a new ticket (after START phase)
- Re-planning after review rejection (with reduced scope)

## Prerequisites (MANDATORY)

Before planning, verify:

1. **Research cache exists** for all technologies
   ```bash
   ls .claude/ledger/research/
   # Must contain files for technologies in this ticket
   ```
   If missing → STOP → invoke `skill:research-external` first

2. **Session ledger initialized**
   ```bash
   cat .claude/ledger/sessions/{TICKET-ID}.md
   ```
   If missing → STOP → invoke `skill:context-keeper` first

## Process

### Step 1: Read Research Cache

Load ALL research files relevant to the ticket:
```bash
cat .claude/ledger/research/prisma.md
cat .claude/ledger/research/nestjs.md
# etc.
```

Extract:
- Version-specific APIs
- Patterns to follow
- Gotchas to avoid

### Step 2: Review Existing Code

**This is NOT optional.** Before planning new code, understand what exists:

1. **Related modules** - How are similar features structured?
   ```bash
   ls src/modules/
   ```

2. **Existing patterns** - What patterns are already in use?
   ```bash
   # Example: check how other entities are structured
   cat src/modules/events/domain/entities/event.entity.ts
   ```

3. **Shared code** - What can be reused?
   ```bash
   ls src/shared/
   ```

4. **Infrastructure** - What's already configured?
   ```bash
   cat src/app.module.ts
   ```

Record findings in plan.

### Step 3: Load Context Files

Based on ticket type, load relevant contexts:

| Ticket Type | Contexts to Load |
|-------------|-----------------|
| New Entity | `patterns/entities.md`, `patterns/cqrs.md` |
| New Module | `structure/feature-sliced.md`, `structure/module-setup.md` |
| Repository | `patterns/repositories.md` |
| Controller | `patterns/controllers.md` |
| Infrastructure | `infrastructure/*.md` (relevant) |

Always load:
- `conventions/naming.md`
- `conventions/error-handling.md`

### Step 4: Generate Plan

Create a structured plan with:

```markdown
## Plan: {TICKET-ID}

### Research Summary
Technologies: {list with versions}
Key findings:
- Finding 1 from research
- Finding 2 from research

### Existing Code Review
Related code found:
- `path/to/file.ts` - Description of what it does
- `path/to/other.ts` - Can reuse X pattern

### Components to Create

| Component | Path | Skill |
|-----------|------|-------|
| Entity | `domain/entities/x.entity.ts` | implement-feature |
| Command | `application/commands/x/x.command.ts` | implement-feature |
| Handler | `application/commands/x/x.handler.ts` | implement-feature |
| Tests | `*.spec.ts` | write-tests |

### Implementation Steps

#### 1. {Step name}
**Skill:** `implement-feature`
**Contexts:** `patterns/entities.md`
**Research:** `prisma.md` (entity mapping)

Tasks:
- Task 1
- Task 2

**Checkpoint:** `git commit -m "feat(x): [TTV-XXX] add X entity"`

#### 2. {Step name}
...

### Validation Criteria
- [ ] Criteria 1
- [ ] Criteria 2
```

## Re-Planning After Review Rejection

When invoked with review feedback:

1. **Read the feedback** from review-code
2. **Scope is REDUCED** - only fix reported issues
3. **Do NOT refactor** unrelated code
4. **Reference session ledger** for context

```markdown
## Re-Plan: {TICKET-ID} (Attempt {N}/3)

### Review Feedback
{paste feedback from review-code}

### Focused Fixes

#### Fix 1: {Issue from feedback}
**File:** `path/to/file.ts`
**Current:** {what's wrong}
**Fix:** {what to do}
**Skill:** implement-feature

#### Fix 2: ...

### Scope Boundary
ONLY fix the above issues. Do not:
- Refactor unrelated code
- Add new features
- Change working code
```

## Output

The plan is used by subsequent skills:
- `implement-feature` follows the steps
- `write-tests` knows what to test
- `review-code` validates against criteria

## Critical Rules

1. **NEVER plan without research cache** - Hallucinations come from assumptions
2. **ALWAYS review existing code** - Don't reinvent what exists
3. **ALWAYS specify contexts per step** - Skills need to know what to load
4. **ALWAYS define commit checkpoints** - Small, functional commits
5. **Planner does NOT implement** - Only plans, `implement-feature` executes
