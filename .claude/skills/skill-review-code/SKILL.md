---
name: review-code
description: >
  Review code for quality and pattern compliance.
  Validates against checklists. Manages retry loop (max 3 attempts).
  On rejection, provides structured feedback for re-planning.
---

# Review Code

Review implementation against project standards. Gate before PR creation.

## When to Use

- After DOCUMENTATION phase completes
- Validating feature implementations
- Quality gate before GIT phase

## Required Context

Load before reviewing:

- `contexts/review/review-process.md`
- `contexts/conventions/anti-patterns.md`
- `contexts/checklists/implementation.md`
- `contexts/checklists/command-review.md` (if commands)
- `contexts/checklists/query-review.md` (if queries)
- `contexts/checklists/repository-review.md` (if repositories)

## Review Process

### Step 1: Load Session Context

```bash
cat .claude/ledger/sessions/{TICKET-ID}.md
```

Check:
- Current attempt number
- Previous feedback (if retry)
- Decisions made during implementation

### Step 2: Run Checklists

Go through ALL relevant checklists:

#### Structure Checklist
- [ ] Files in correct folders (Feature-Sliced)
- [ ] Naming conventions followed
- [ ] Layer boundaries respected (domain → application → infrastructure → presentation)
- [ ] No circular dependencies

#### Pattern Checklist
- [ ] Entity has factory method with validations
- [ ] Handler is thin (<30 lines)
- [ ] Repository uses separate Mapper class
- [ ] Controller has `@SuccessMessage()` decorator
- [ ] Projections used for read operations
- [ ] AppException used (not generic Error)

#### Code Quality Checklist
- [ ] No linting errors (`pnpm check`)
- [ ] No commented-out code
- [ ] No console.log statements
- [ ] No hardcoded values that should be config
- [ ] JSDoc on public methods

#### Test Checklist
- [ ] Complex logic (CC ≥ 5) has unit tests
- [ ] Repositories have integration tests
- [ ] Tests follow AAA pattern
- [ ] Tests are independent

### Step 3: Generate Report

```markdown
## Review Report: {TICKET-ID}

**Attempt:** {N}/3
**Date:** {date}

### Checklist Results

#### Structure
- [x] Files in correct folders
- [ ] ❌ Naming: `photoRepository` should be `PhotoWriteRepository`

#### Patterns
- [x] Entity has factory method
- [x] Handler is thin
- [ ] ❌ Repository has inline mapping (should use Mapper)

#### Code Quality
- [x] No linting errors
- [x] No console.log

#### Tests
- [x] Unit tests present
- [ ] ❌ Missing test for edge case X

### Issues Found

| Severity | File | Issue |
|----------|------|-------|
| Critical | `repo.ts:45` | Inline mapping instead of Mapper |
| High | `handler.ts:12` | Missing validation |
| Medium | `entity.ts` | JSDoc incomplete |

### Verdict

- [ ] ✅ APPROVED
- [x] ❌ CHANGES REQUESTED
```

## Decision: Approved vs Rejected

### If APPROVED ✅

```markdown
### Verdict: APPROVED

All checklists pass. Ready for PR.

**Next:** Proceed to GIT phase
- skill:manage-git → Create PR
- skill:context-keeper → Finalize session
```

Update session ledger:
```markdown
## Status
phase: approved
review_attempts: {N}/3
```

### If REJECTED ❌

Check attempt count in session ledger.

#### Attempt 1 or 2: Retry Loop

Generate **structured feedback** for re-planning:

```markdown
### Verdict: CHANGES REQUESTED (Attempt {N}/3)

#### Feedback for Re-Planning

**Failed Checks:**
1. [ ] Repository inline mapping - `src/modules/x/infrastructure/repositories/x.repository.ts:45`
2. [ ] Missing edge case test - `handler.spec.ts`

**Required Fixes:**

##### Fix 1: Repository Mapping
**File:** `src/modules/x/infrastructure/repositories/x.repository.ts`
**Line:** 45
**Issue:** Inline mapping in repository method
**Current:**
```typescript
return {
  id: record.id,
  name: record.name,
  // ... inline mapping
};
```
**Expected:** Use dedicated Mapper class
**Reference:** `contexts/patterns/repositories.md`

##### Fix 2: Missing Test
**File:** `src/modules/x/application/commands/x.handler.spec.ts`
**Issue:** No test for when entity validation fails
**Expected:** Add test case for AppException.businessRule

**Scope Boundary:**
- ONLY fix the issues listed above
- Do NOT refactor other code
- Do NOT add features

**Next:** Return to PLANIFICATION
- skill:plan-task receives this feedback
- Creates focused fix plan
- Continue: IMPLEMENTATION → TESTING → DOCUMENTATION → REVIEW
```

Update session ledger:
```markdown
## Status
phase: review-rejected
review_attempts: {N}/3

## Review History
### Attempt {N}
- Repository inline mapping
- Missing edge case test
```

#### Attempt 3: Stop and Escalate

```markdown
### Verdict: ESCALATED TO MANUAL REVIEW (Attempt 3/3)

After 3 attempts, issues persist. Creating PR with documented issues for human intervention.

#### Persistent Issues
1. Issue 1 - attempted fixes X, Y, Z
2. Issue 2 - attempted fixes A, B

#### Recommendation
Manual review required. Possible causes:
- Pattern may not fit this use case
- Requirement ambiguity
- Technical limitation

**Next:** Proceed to GIT phase
- Create PR with "needs-manual-review" label
- Document issues in PR description
- Human will review and decide
```

Update session ledger:
```markdown
## Status
phase: escalated
review_attempts: 3/3
needs_manual_review: true

## Escalation Reason
{summary of persistent issues}
```

## Review Priority Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | Architecture violation, security issue | Block - must fix |
| **High** | Pattern violation, missing tests for complex code | Block - must fix |
| **Medium** | Code style, incomplete docs | Can approve with notes |
| **Low** | Suggestions, minor optimizations | Approve, note for future |

**Rule:** Any Critical or High issue = REJECTED

## Checklist Quick Reference

### For Commands
- [ ] DTO has class-validator decorators
- [ ] Command is immutable (readonly properties)
- [ ] Handler < 30 lines
- [ ] Uses entity factory method
- [ ] Returns `{ id }` or Projection

### For Queries
- [ ] Query DTO for filtering/pagination
- [ ] Handler returns Projection (not entity)
- [ ] Uses Read Repository
- [ ] No write operations

### For Repositories
- [ ] Separate Write and Read repositories
- [ ] Uses dedicated Mapper class
- [ ] No inline object mapping
- [ ] Handles not found with AppException

### For Controllers
- [ ] `@SuccessMessage()` decorator
- [ ] Swagger decorators
- [ ] Only converts DTO → Command/Query
- [ ] No business logic
