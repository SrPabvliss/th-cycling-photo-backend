---
name: manage-git
description: >
  Manage git operations AND Jira ticket lifecycle.
  Handles commits, branches, PRs, and ticket state transitions.
---

# Manage Git & Jira

Handle git operations and Jira ticket lifecycle.

## When to Use

- **Start of ticket:** Transition to "In Progress", create branch
- **During implementation:** Create commits at checkpoints
- **End of ticket:** Create PR, transition to "Ready for Review"

## Required Context

- `contexts/conventions/git.md` - Full git conventions

## Jira Ticket Lifecycle

### At Task Start
```
→ Jira MCP: Transition ticket to "In Progress"
→ Git: Create branch feat/{TICKET-ID}
→ Ledger: Create session file
```

### At Task End
```
→ Git: Push branch, create PR
→ Jira MCP: Transition ticket to "Ready for Review"
→ Jira MCP: Add PR link as comment
```

### Jira MCP Commands

```typescript
// Transition ticket
jira.transitionIssue('TTV-1001', 'In Progress')
jira.transitionIssue('TTV-1001', 'Ready for Review')

// Add comment with PR link
jira.addComment('TTV-1001', 'PR: https://github.com/...')
```

## Commit & Branch Conventions

> Follow `conventions/git.md` for commit message format, branch naming, and PR template.

## Complete Workflow

### 1. Start Task
```bash
# Transition Jira (via MCP)
→ Jira: TTV-1001 → "In Progress"

# Create branch
git checkout main
git pull origin main
git checkout -b feat/TTV-1001
```

### 2. During Implementation (at checkpoints)
```bash
git add .
git commit -m "feat(events): [TTV-1001] add Event entity"
```

### 3. End Task
```bash
# Push and create PR
git push -u origin feat/TTV-1001
# Create PR via GitHub

# Transition Jira (via MCP)
→ Jira: TTV-1001 → "Ready for Review"
→ Jira: Add comment with PR link
```

## Checklist

- [ ] Jira transitioned to "In Progress" at start
- [ ] Branch name is `type/TTV-XXXX`
- [ ] Commits include ticket `[TTV-XXXX]`
- [ ] PR created and linked to Jira
- [ ] Jira transitioned to "Ready for Review" at end
