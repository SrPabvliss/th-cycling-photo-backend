# Prompt Template for Claude Code

## Usage

1. Copy this template when preparing a ticket
2. Fill in the placeholders `{...}`
3. Add the completed prompt as a **Jira comment** on the ticket
4. When executing: copy the prompt from Jira → paste in Claude Code

---

## Template

```markdown
# {TICKET-ID}: {Title}

## Contexts (load before starting)
{List relevant context files based on ticket type}

- `.claude/contexts/patterns/{x}.md`
- `.claude/contexts/conventions/{y}.md`
- `.claude/project_docs/{z}.md` (if applicable)

## Research
Technologies involved: {Prisma, NestJS, class-validator, etc.}

→ Use Context7 MCP for current documentation
→ Save findings to `.claude/ledger/research/`

## Workflow
Execute in order:

1. `skill:manage-git` → Create branch, transition Jira to "In Progress"
2. `skill:context-keeper` → Initialize session ledger
3. `skill:research-external` → Research technologies with Context7
4. `skill:plan-task` → Review existing code, create implementation plan
5. `skill:implement-feature` → Execute plan with small commits
6. `skill:write-tests` → Tests based on cyclomatic complexity
7. `skill:document-code` → JSDoc, README if needed
8. `skill:review-code` → Validate against checklists
9. `skill:manage-git` → Create PR, transition Jira to "Ready for Review"
10. `skill:context-keeper` → Finalize session ledger

## Ticket
{Brief description of what needs to be done - can reference Jira for full details}

## Success Criteria
{What must be true when the ticket is done}

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3
```

---

## Context Selection Guide

Use this to fill the "Contexts" section:

| Ticket Type | Contexts to Include |
|-------------|---------------------|
| **New Entity** | `patterns/entities.md`, `patterns/cqrs.md`, `conventions/naming.md` |
| **New Module** | `structure/feature-sliced.md`, `structure/module-setup.md` |
| **Command/Handler** | `patterns/cqrs.md`, `conventions/error-handling.md` |
| **Query/Projection** | `patterns/cqrs.md`, `patterns/repositories.md` |
| **Repository** | `patterns/repositories.md`, `infrastructure/prisma-setup.md` |
| **Controller** | `patterns/controllers.md`, `conventions/validations.md` |
| **Infrastructure** | `infrastructure/*.md` (relevant ones) |
| **HTTP/API setup** | `conventions/error-handling.md`, project_docs if available |

**Always include:**
- `conventions/naming.md`
- `conventions/git.md`

---

## Example: Filled Template

```markdown
# TTV-8: Configure standardized HTTP response format (ADR-002)

## Contexts (load before starting)
- `.claude/contexts/conventions/error-handling.md`
- `.claude/contexts/conventions/naming.md`
- `.claude/contexts/infrastructure/nestjs-bootstrap.md`
- `.claude/project_docs/ADR-002.md` (if available)

## Research
Technologies involved: NestJS 11, class-validator, nestjs-i18n

→ Use Context7 MCP for current documentation
→ Save findings to `.claude/ledger/research/`

## Workflow
Execute in order:

1. `skill:manage-git` → Create branch, transition Jira to "In Progress"
2. `skill:context-keeper` → Initialize session ledger
3. `skill:research-external` → Research technologies with Context7
4. `skill:plan-task` → Review existing code, create implementation plan
5. `skill:implement-feature` → Execute plan with small commits
6. `skill:write-tests` → Tests based on cyclomatic complexity
7. `skill:document-code` → JSDoc, README if needed
8. `skill:review-code` → Validate against checklists
9. `skill:manage-git` → Create PR, transition Jira to "Ready for Review"
10. `skill:context-keeper` → Finalize session ledger

## Ticket
Implement standardized HTTP response system per ADR-002:
- Success responses: `{ data, meta: { message?, requestId, timestamp } }`
- Error responses: `{ error: { code, message, shouldThrow, fields?, details? }, meta }`
- GlobalExceptionFilter, AppException, ResponseInterceptor
- i18n support (es/en)

## Success Criteria
- [ ] All responses follow ADR-002 structure
- [ ] Validation errors include `fields` property
- [ ] `details` and `stack` only in development
- [ ] i18n configured with es/en translations
- [ ] Unit tests for exception filter
- [ ] E2E test verifying response format
```

---

## Notes

- **Don't over-specify implementation steps** — that's `skill:plan-task`'s job
- **Do specify contexts** — Claude Code won't load them automatically
- **Do specify technologies for research** — ensures Context7 is used
- **Success criteria = Definition of Done** — what the reviewer will check
