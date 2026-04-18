---
name: context-keeper
description: >
  TRANSVERSAL SKILL - Manages session state throughout the entire workflow.
  Invoked at START, after each commit, after decisions, and at GIT (end).
  Maintains session ledger and research cache for context optimization.
---

# Context Keeper (Transversal)

**Role:** Maintain session state and optimize context across the entire workflow.

**This is NOT a phase-specific skill.** It runs at multiple points during the workflow.

## When to Invoke

| Trigger | Action |
|---------|--------|
| **START phase** | Initialize session ledger |
| **After each commit** | Update progress |
| **After important decisions** | Record decision |
| **After review attempt** | Record attempt + feedback |
| **GIT phase (end)** | Finalize session |
| **Before external research** | Check research cache |
| **After external research** | Update research cache |

## Session Ledger

### Purpose

1. **Traceability** - Record what happened during the session
2. **Context optimization** - Quick reference without re-reading all code
3. **Recovery** - If session interrupted, resume from ledger state
4. **Review tracking** - Track attempts and feedback

### Location

```
.claude/ledger/sessions/{TICKET-ID}.md
```

### Initialize (START phase)

Create from template and fill initial data:

```bash
cp .claude/ledger/sessions/_TEMPLATE.md .claude/ledger/sessions/TTV-XXX.md
```

> See `ledger/sessions/_TEMPLATE.md` for the full template structure. Fill ticket info, set phase to `start`, and add initial timeline entry.

### Update After Commit

After each commit checkpoint:

```markdown
## Timeline
- {timestamp} Session initialized
- {timestamp} Branch created: feat/TTV-XXX
- {timestamp} Entity created: Event.entity.ts
- {timestamp} Commit: feat(events): [TTV-XXX] add Event entity

## Files Changed
- src/modules/events/domain/entities/event.entity.ts (created)
- src/modules/events/domain/value-objects/event-status.vo.ts (created)
```

### Update After Decision

When a technical decision is made:

```markdown
## Decisions
- Used UUID for entity ID (consistent with other entities)
- Placed validation in factory method, not constructor
- Used AppException.businessRule for date validation
```

### Update After Review Attempt

```markdown
## Status
phase: review-rejected
review_attempts: 2/3

## Review History
### Attempt 1
**Result:** Rejected
**Issues:**
- Missing mapper functions
- Inline mapping in repository

### Attempt 2
**Result:** Rejected
**Issues:**
- Mapper created but not used in one method
```

### Finalize (GIT phase)

```markdown
## Status
phase: completed
review_attempts: 1/3

## Timeline
- {timestamp} Session initialized
- {timestamp} Branch created
- ...
- {timestamp} Review passed
- {timestamp} PR created: #42
- {timestamp} Session finalized

## Summary
Implemented Event entity with CQRS pattern. Created CreateEventCommand
with full validation. Repository uses dedicated EventMapper.

## PR
https://github.com/user/repo/pull/42
```

## Research Cache

### Purpose

Avoid repeated Context7 queries. Store findings locally.

### Location

```
.claude/ledger/research/{technology}.md
```

### Check Before Research

Before invoking `skill:research-external`:

```bash
# Check if cache exists
cat .claude/ledger/research/prisma-client.md

# If exists, check if sufficient for current need
# If not exists or outdated → proceed with research
```

### Cache Structure

> Research cache format and template: see `skill-research-external/SKILL.md` and `ledger/research/_TEMPLATE.md`

## Update Rules

### Session Ledger
- **State only** - No code snippets (reference files instead)
- **Max ~50 lines** - Keep it scannable
- **Overwrite sections** - Don't append infinitely
- **Update, don't duplicate** - Modify existing entries

### Research Cache
- **Facts only** - No implementation details
- **Include version** - APIs change between versions
- **Include gotchas** - Save debugging time
- **Include examples** - Copy-paste ready

## Quick Reference

### Initialize Session
```bash
# Create session file
cp .claude/ledger/sessions/_TEMPLATE.md .claude/ledger/sessions/TTV-XXX.md

# Edit with initial data
# Set phase: start
# Add ticket info
```

### Update Progress
```bash
# After commit, update:
# - Timeline section (add entry)
# - Files Changed section (add/update)
# - Status phase if changed
```

### Check Research
```bash
# Before Context7 query
ls .claude/ledger/research/
cat .claude/ledger/research/{tech}.md

# Decide: use cache or research fresh
```

### Finalize
```bash
# At end:
# - Status phase: completed
# - Add PR link
# - Add summary
```
