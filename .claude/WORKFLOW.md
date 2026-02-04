# Development Workflow

## Overview

This document defines the complete workflow for implementing tickets using Claude Code. The workflow is designed to mimic a professional development team with specialized roles (skills).

**Key Principle:** Each skill has a specific responsibility. Skills don't overlap. The workflow orchestrates them in sequence.

---

## Phases

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANUAL PHASE (Pre-Loop)                      │
│              Ticket creation (Pablo + Claude.ai)                │
│              Output: Jira ticket with prompt comment            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT LOOP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. START                                                       │
│     ├─ skill:manage-git      → Branch + Jira "In Progress"     │
│     └─ skill:context-keeper  → Initialize session ledger        │
│                                                                 │
│  2. PLANIFICATION                                               │
│     ├─ skill:research-external → Context7 → ledger/research/   │
│     └─ skill:plan-task         → Code review + Implementation  │
│                                   plan                          │
│                                                                 │
│  3. IMPLEMENTATION                                              │
│     └─ skill:implement-feature → Follow plan, small commits    │
│         └─ skill:context-keeper → Update ledger per commit     │
│                                                                 │
│  4. TESTING                                                     │
│     └─ skill:write-tests → Based on cyclomatic complexity      │
│                                                                 │
│  5. DOCUMENTATION                                               │
│     └─ skill:document-code → JSDoc, README, changelog          │
│                                                                 │
│  6. REVIEW                                                      │
│     └─ skill:review-code → Checklists validation               │
│         ├─ APPROVED → Continue to GIT                          │
│         └─ REJECTED → Retry loop (max 3 attempts)              │
│                                                                 │
│  7. GIT                                                         │
│     ├─ skill:manage-git      → PR + Jira "Ready for Review"    │
│     └─ skill:context-keeper  → Finalize session ledger         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase Details

### 1. START

**Purpose:** Initialize the work session with proper tracking and git setup.

**Skills invoked:**
1. `skill:manage-git`
   - Create branch: `feat/TTV-XXX` or `fix/TTV-XXX`
   - Transition Jira ticket to "In Progress"

2. `skill:context-keeper`
   - Create session ledger: `.claude/ledger/sessions/TTV-XXX.md`
   - Initialize with ticket info and status

**Output:**
- Branch created and checked out
- Jira ticket in "In Progress"
- Session ledger initialized

---

### 2. PLANIFICATION

**Purpose:** Research technologies and create an informed implementation plan.

**Skills invoked:**
1. `skill:research-external` (ALWAYS FIRST)
   - Identify technologies involved in the ticket
   - Query Context7 MCP for current documentation
   - Save findings to `.claude/ledger/research/{technology}.md`
   - Check existing cache before querying

2. `skill:plan-task`
   - Read research cache (MANDATORY - don't proceed without it)
   - Review existing codebase for related code
   - Load relevant context files
   - Generate implementation plan with:
     - Files to create/modify
     - Implementation order
     - Commit checkpoints
     - Skill assignments per task

**Output:**
- Research cache updated
- Implementation plan with clear steps

**Critical Rules:**
- NEVER skip research phase
- NEVER plan without reading existing code
- Plan must reference research cache

---

### 3. IMPLEMENTATION

**Purpose:** Execute the plan following project patterns.

**Skills invoked:**
1. `skill:implement-feature`
   - Follow the plan step by step
   - Load required context files (patterns, conventions)
   - Verify research cache before using external APIs
   - Make small, functional commits at checkpoints

2. `skill:context-keeper` (after each commit)
   - Update session ledger with progress
   - Record decisions made
   - Track files changed

**Output:**
- Code implemented following patterns
- Small commits at logical checkpoints
- Session ledger updated

**Commit Guidelines:**
- Each commit must be functional (project doesn't break)
- Format: `type(scope): [TTV-XXX] description`
- Commit at logical boundaries (entity done, handler done, etc.)

---

### 4. TESTING

**Purpose:** Write valuable tests based on complexity.

**Skills invoked:**
1. `skill:write-tests`
   - Evaluate cyclomatic complexity of implemented code
   - CC ≥ 5: Unit test REQUIRED
   - CC < 2: Integration test only
   - CC 3-4: Evaluate importance

**Output:**
- Unit tests for complex logic
- Integration tests for repositories
- Tests follow AAA pattern

**Philosophy:** Quality over coverage percentage.

---

### 5. DOCUMENTATION

**Purpose:** Document code for maintainability.

**Skills invoked:**
1. `skill:document-code`
   - Add JSDoc to public methods
   - Create/update module README if new module
   - Update CHANGELOG if user-facing changes

**Output:**
- JSDoc on public methods and factory methods
- README for new modules
- CHANGELOG entries

---

### 6. REVIEW

**Purpose:** Validate implementation against project standards.

**Skills invoked:**
1. `skill:review-code`
   - Run through all checklists
   - Verify patterns compliance
   - Check for anti-patterns
   - Generate review report

**Outcomes:**

#### If APPROVED:
- Continue to GIT phase

#### If REJECTED (Attempt 1 or 2):
- Generate structured feedback with:
  - What failed (specific checklist items)
  - Where it failed (file:line)
  - What should be corrected
- Return to PLANIFICATION with reduced scope
- `skill:plan-task` receives feedback and creates focused fix plan
- Continue through IMPLEMENTATION → TESTING → DOCUMENTATION → REVIEW

#### If REJECTED (Attempt 3):
- Stop retry loop (prevents infinite cycles)
- Create PR anyway with issues documented
- Add "needs-manual-review" label
- Document issues in PR description
- Human intervention required

**Output:**
- Review report
- Either approval or structured feedback

---

### 7. GIT

**Purpose:** Finalize work and prepare for merge.

**Skills invoked:**
1. `skill:manage-git`
   - Push branch to remote
   - Create Pull Request with:
     - Summary of changes
     - Link to Jira ticket
     - If attempt 3 failed: documented issues
   - Transition Jira to "Ready for Review"
   - Add PR link as Jira comment

2. `skill:context-keeper`
   - Finalize session ledger
   - Mark session as complete
   - Record final status

**Output:**
- PR created and linked
- Jira ticket ready for review
- Session ledger finalized

---

## Retry Loop Details

```
REVIEW REJECTED
      │
      ▼
┌─────────────────────────────────────────┐
│ Attempt < 3?                            │
├─────────────────────────────────────────┤
│ YES:                                    │
│   1. Generate structured feedback       │
│   2. Update session ledger with attempt │
│   3. Return to PLANIFICATION            │
│   4. skill:plan-task receives feedback  │
│   5. Creates FOCUSED plan (only fixes)  │
│   6. Continue: IMPL → TEST → DOC → REV  │
├─────────────────────────────────────────┤
│ NO (Attempt 3):                         │
│   1. Stop retrying                      │
│   2. Document all issues                │
│   3. Create PR with issues noted        │
│   4. Request manual intervention        │
└─────────────────────────────────────────┘
```

**Feedback Structure for Retry:**
```markdown
## Review Feedback (Attempt X/3)

### Failed Checks
- [ ] Check 1: description of failure
- [ ] Check 2: description of failure

### Required Fixes
1. **[file:line]** Issue description
   - Current: `problematic code`
   - Expected: `correct approach`

### Scope
Only fix the above issues. Do not refactor unrelated code.
```

---

## Transversal Skill: context-keeper

`skill:context-keeper` runs at multiple points:

| When | Action |
|------|--------|
| START | Create session ledger |
| After each commit | Update progress |
| After decisions | Record decision |
| After review attempt | Record attempt and feedback |
| GIT (end) | Finalize session |

**Session Ledger Purpose:**
1. **Traceability** - Know what happened in the session
2. **Context optimization** - Quick reference without re-reading code
3. **Recovery** - If session interrupted, resume from ledger state

---

## Skill Reference

| Skill | Primary Responsibility | Invoked In |
|-------|----------------------|------------|
| `context-keeper` | Session state management | Transversal |
| `manage-git` | Git + Jira operations | START, GIT |
| `research-external` | External documentation | PLANIFICATION |
| `plan-task` | Implementation planning | PLANIFICATION |
| `implement-feature` | Code implementation | IMPLEMENTATION |
| `write-tests` | Test creation | TESTING |
| `document-code` | Documentation | DOCUMENTATION |
| `review-code` | Quality validation | REVIEW |

---

## Context Loading

Each skill specifies which contexts to load. Common patterns:

| Task Type | Contexts |
|-----------|----------|
| Entity creation | `patterns/entities.md`, `conventions/naming.md` |
| Command/Handler | `patterns/cqrs.md`, `conventions/error-handling.md` |
| Repository | `patterns/repositories.md`, `infrastructure/prisma-setup.md` |
| Controller | `patterns/controllers.md`, `conventions/validations.md` |
| Tests | `testing/*.md` |
| Review | `checklists/*.md`, `conventions/anti-patterns.md` |

---

## Quick Reference

**Start working:**
```
1. skill:manage-git → branch + Jira
2. skill:context-keeper → session ledger
```

**Plan:**
```
3. skill:research-external → Context7 research
4. skill:plan-task → implementation plan
```

**Build:**
```
5. skill:implement-feature → code + commits
   └─ skill:context-keeper → update ledger
```

**Validate:**
```
6. skill:write-tests → tests
7. skill:document-code → docs
8. skill:review-code → validation
```

**Finish:**
```
9. skill:manage-git → PR + Jira
10. skill:context-keeper → finalize
```
