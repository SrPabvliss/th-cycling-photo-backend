---
name: context-keeper
description: >
  Manage session context and research cache to optimize token usage.
  Use ALWAYS at session start to load/create ticket context.
  Use before external research to check cache first.
---

# ContextKeeper

Optimize token consumption by maintaining local context ledger.

## When to Use

- **Session Start**: Load or create session for current ticket
- **Before Research**: Check research cache before MCP calls
- **After Decisions**: Update session with decisions made
- **After Review**: Update review attempts and feedback

## Session Management

### Starting Work on a Ticket

1. Read session file: `.claude/ledger/sessions/{TICKET-ID}.md`
2. If not exists, create from template: `.claude/ledger/sessions/_TEMPLATE.md`
3. Update status to current phase

```markdown
## Status
phase: implementing
blocked: false
review_attempts: 0/3
```

### Updating Session

Update relevant sections, don't append infinitely:

```markdown
## Decisions
- Socket.io v4.7 (better NestJS integration)
- Gateway in shared/ (reusable)

## Files Changed
src/shared/infrastructure/websockets/
src/modules/events/gateways/
```

### Review Cycle Tracking

```markdown
## Status
review_attempts: 2/3

## Notes
Attempt 1: Missing tests for disconnect
Attempt 2: Naming convention in gateway
```

**Rule**: Max 3 attempts. On 3rd failure → create PR with issues noted.

## Research Cache

### Before Investigating

1. Check if exists: `.claude/ledger/research/{technology}.md`
2. If exists and sufficient → use cached info
3. If not exists or outdated → research → update cache

### Caching Research

```markdown
# Socket.io

## Info
version: 4.7.5
installed: true
docs: https://socket.io/docs/v4

## Key Notes
- Use @nestjs/platform-socket.io for NestJS
- Requires adapter for Redis in cluster mode

## Integration
Gateway extends WebSocketGateway from @nestjs/websockets
```

## Path Reference

| Type | Path Pattern |
|------|--------------|
| Session | `.claude/ledger/sessions/{TICKET-ID}.md` |
| Research | `.claude/ledger/research/{technology}.md` |
| Session Template | `.claude/ledger/sessions/_TEMPLATE.md` |
| Research Template | `.claude/ledger/research/_TEMPLATE.md` |

## Rules

1. **Sessions**: State only, NO code, max ~50 lines
2. **Research**: Facts only, NO implementation details
3. **Update**: Overwrite sections, don't append history
4. **Check first**: Always check cache before external calls
